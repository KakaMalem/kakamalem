-- =============================================================================
-- Payment Ledger Cleanup Migration
-- =============================================================================
-- This migration implements a ledger-based payment system where:
-- 1. order_payments and refunds tables are the single source of truth
-- 2. amount_paid and amount_refunded on orders are cached values auto-synced by triggers
-- 3. is_paid, payment_status, and amount_due are deprecated (computed in app layer)
--
-- Run with: pnpm db:migrate:custom
-- =============================================================================

-- =============================================================================
-- STEP 1: Create trigger function to sync payment amounts
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_order_payment_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_total_paid DECIMAL(14,2);
    v_total_refunded DECIMAL(14,2);
    v_order_total DECIMAL(14,2);
    v_is_paid BOOLEAN;
    v_payment_status TEXT;
BEGIN
    -- Determine which order to update
    IF TG_OP = 'DELETE' THEN
        v_order_id := OLD.order_id;
    ELSE
        v_order_id := NEW.order_id;
    END IF;

    -- Calculate total paid from order_payments
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM order_payments
    WHERE order_id = v_order_id;

    -- Calculate total refunded from refunds (only completed refunds)
    SELECT COALESCE(SUM(subtotal + shipping_refund + tax_refund), 0)
    INTO v_total_refunded
    FROM refunds
    WHERE order_id = v_order_id
    AND status = 'completed';

    -- Get order total
    SELECT total INTO v_order_total
    FROM orders
    WHERE id = v_order_id;

    -- Compute is_paid and payment_status for backward compatibility
    -- These fields are deprecated but we'll keep them in sync during transition
    IF v_total_refunded > 0 THEN
        IF v_total_refunded >= v_total_paid - 0.01 THEN
            v_is_paid := FALSE;
            v_payment_status := 'refunded';
        ELSE
            v_is_paid := TRUE;
            v_payment_status := 'partial_refund';
        END IF;
    ELSIF v_total_paid >= v_order_total - 0.01 THEN
        v_is_paid := TRUE;
        v_payment_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_is_paid := FALSE;
        v_payment_status := 'partial';
    ELSE
        v_is_paid := FALSE;
        v_payment_status := 'unpaid';
    END IF;

    -- Update the order with synced values
    -- Cast v_payment_status to the payment_status enum type
    UPDATE orders
    SET
        amount_paid = v_total_paid,
        amount_refunded = v_total_refunded,
        amount_due = GREATEST(0, v_order_total - v_total_paid + v_total_refunded),
        is_paid = v_is_paid,
        payment_status = v_payment_status::payment_status,
        paid_at = CASE
            WHEN v_is_paid AND paid_at IS NULL THEN NOW()
            WHEN NOT v_is_paid THEN NULL
            ELSE paid_at
        END,
        updated_at = NOW()
    WHERE id = v_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 2: Create triggers on order_payments table
-- =============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_sync_payment_on_insert ON order_payments;
DROP TRIGGER IF EXISTS trigger_sync_payment_on_update ON order_payments;
DROP TRIGGER IF EXISTS trigger_sync_payment_on_delete ON order_payments;

-- Create triggers for INSERT, UPDATE, DELETE
CREATE TRIGGER trigger_sync_payment_on_insert
    AFTER INSERT ON order_payments
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

CREATE TRIGGER trigger_sync_payment_on_update
    AFTER UPDATE ON order_payments
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

CREATE TRIGGER trigger_sync_payment_on_delete
    AFTER DELETE ON order_payments
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

-- =============================================================================
-- STEP 3: Create triggers on refunds table
-- =============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_sync_refund_on_insert ON refunds;
DROP TRIGGER IF EXISTS trigger_sync_refund_on_update ON refunds;
DROP TRIGGER IF EXISTS trigger_sync_refund_on_delete ON refunds;

-- Create triggers for INSERT, UPDATE, DELETE
CREATE TRIGGER trigger_sync_refund_on_insert
    AFTER INSERT ON refunds
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

CREATE TRIGGER trigger_sync_refund_on_update
    AFTER UPDATE ON refunds
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

CREATE TRIGGER trigger_sync_refund_on_delete
    AFTER DELETE ON refunds
    FOR EACH ROW
    EXECUTE FUNCTION sync_order_payment_totals();

-- =============================================================================
-- STEP 4: Sync existing data - Migrate payment records to amount_paid
-- =============================================================================

-- First, update amount_paid from actual payment records
UPDATE orders o
SET amount_paid = COALESCE(
    (SELECT SUM(amount) FROM order_payments WHERE order_id = o.id),
    0
)
WHERE EXISTS (SELECT 1 FROM order_payments WHERE order_id = o.id);

-- =============================================================================
-- STEP 5: Handle legacy orders where is_paid=true but no payment records
-- =============================================================================

-- For legacy orders marked as paid but with no payment records,
-- create a payment record to preserve the data
INSERT INTO order_payments (order_id, amount, payment_method, notes, created_at)
SELECT
    o.id,
    o.total,
    COALESCE(o.payment_method, 'cash'),
    'Auto-migrated from legacy is_paid flag',
    COALESCE(o.paid_at, o.created_at)
FROM orders o
WHERE o.is_paid = TRUE
AND NOT EXISTS (SELECT 1 FROM order_payments WHERE order_id = o.id)
AND COALESCE(o.amount_paid, '0')::decimal < o.total::decimal - 0.01;

-- =============================================================================
-- STEP 6: Sync amount_refunded from refunds table
-- =============================================================================

UPDATE orders o
SET amount_refunded = COALESCE(
    (SELECT SUM(subtotal + shipping_refund + tax_refund)
     FROM refunds
     WHERE order_id = o.id AND status = 'completed'),
    0
)
WHERE EXISTS (SELECT 1 FROM refunds WHERE order_id = o.id AND status = 'completed');

-- =============================================================================
-- STEP 7: Recalculate all payment statuses based on actual amounts
-- =============================================================================

UPDATE orders
SET
    amount_due = GREATEST(0, total::decimal - COALESCE(amount_paid, '0')::decimal + COALESCE(amount_refunded, '0')::decimal),
    is_paid = CASE
        WHEN COALESCE(amount_refunded, '0')::decimal >= COALESCE(amount_paid, '0')::decimal - 0.01
             AND COALESCE(amount_refunded, '0')::decimal > 0 THEN FALSE
        WHEN COALESCE(amount_paid, '0')::decimal >= total::decimal - 0.01 THEN TRUE
        ELSE FALSE
    END,
    payment_status = (CASE
        WHEN COALESCE(amount_refunded, '0')::decimal >= COALESCE(amount_paid, '0')::decimal - 0.01
             AND COALESCE(amount_refunded, '0')::decimal > 0 THEN 'refunded'
        WHEN COALESCE(amount_refunded, '0')::decimal > 0 THEN 'partial_refund'
        WHEN COALESCE(amount_paid, '0')::decimal >= total::decimal - 0.01 THEN 'paid'
        WHEN COALESCE(amount_paid, '0')::decimal > 0 THEN 'partial'
        ELSE 'unpaid'
    END)::payment_status;

-- =============================================================================
-- STEP 8: Add helpful comments to deprecated columns
-- =============================================================================

COMMENT ON COLUMN orders.is_paid IS 'DEPRECATED: Use (amount_paid >= total) instead. Auto-synced by trigger.';
COMMENT ON COLUMN orders.payment_status IS 'DEPRECATED: Compute from amount_paid, amount_refunded, total. Auto-synced by trigger.';
COMMENT ON COLUMN orders.amount_due IS 'DEPRECATED: Compute as (total - amount_paid + amount_refunded). Auto-synced by trigger.';
COMMENT ON COLUMN orders.amount_paid IS 'Cached value auto-synced from order_payments by trigger. Source of truth: order_payments table.';
COMMENT ON COLUMN orders.amount_refunded IS 'Cached value auto-synced from refunds by trigger. Source of truth: refunds table.';

-- =============================================================================
-- STEP 9: Create a helper view for easy payment status queries
-- =============================================================================

CREATE OR REPLACE VIEW order_payment_summary AS
SELECT
    o.id AS order_id,
    o.order_number,
    o.tenant_id,
    o.total::decimal AS order_total,
    COALESCE(o.amount_paid, '0')::decimal AS amount_paid,
    COALESCE(o.amount_refunded, '0')::decimal AS amount_refunded,
    GREATEST(0, o.total::decimal - COALESCE(o.amount_paid, '0')::decimal + COALESCE(o.amount_refunded, '0')::decimal) AS amount_due,
    CASE
        WHEN COALESCE(o.amount_refunded, '0')::decimal >= COALESCE(o.amount_paid, '0')::decimal - 0.01
             AND COALESCE(o.amount_refunded, '0')::decimal > 0 THEN 'refunded'
        WHEN COALESCE(o.amount_refunded, '0')::decimal > 0 THEN 'partial_refund'
        WHEN COALESCE(o.amount_paid, '0')::decimal >= o.total::decimal - 0.01 THEN 'paid'
        WHEN COALESCE(o.amount_paid, '0')::decimal > 0 THEN 'partial'
        ELSE 'unpaid'
    END AS payment_status,
    (SELECT COUNT(*) FROM order_payments WHERE order_id = o.id) AS payment_count,
    (SELECT COUNT(*) FROM refunds WHERE order_id = o.id AND status = 'completed') AS refund_count
FROM orders o;

-- Grant access to the view
GRANT SELECT ON order_payment_summary TO PUBLIC;

-- =============================================================================
-- Done! Summary of changes:
-- 1. Created sync_order_payment_totals() trigger function
-- 2. Added triggers on order_payments and refunds tables
-- 3. Migrated existing payment data to amount_paid
-- 4. Created payment records for legacy is_paid orders
-- 5. Synced amount_refunded from refunds table
-- 6. Recalculated all payment statuses
-- 7. Added deprecation comments
-- 8. Created order_payment_summary view for easy queries
-- =============================================================================
