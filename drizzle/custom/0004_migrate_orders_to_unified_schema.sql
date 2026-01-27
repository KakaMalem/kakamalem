-- Migration: Migrate orders to unified schema
-- Backfills paymentStatus, payment amounts, and timestamps
-- NOTE: sales_channel -> channel migration is now handled in drizzle migration 0019

-- Step 1: (REMOVED - Now handled in drizzle migration 0019 before column drop)
-- The sales_channel to channel mapping is now done inline in migration 0019
-- to ensure data is migrated BEFORE the column is dropped.

-- Step 2: Backfill payment_status based on existing data
-- Calculate total paid from order_payments table
WITH payment_totals AS (
  SELECT
    order_id,
    COALESCE(SUM(amount), 0) as total_paid
  FROM order_payments
  GROUP BY order_id
)
UPDATE orders o
SET
  amount_paid = COALESCE(pt.total_paid, 0),
  amount_due = GREATEST(0, o.total - COALESCE(pt.total_paid, 0)),
  payment_status = CASE
    WHEN COALESCE(pt.total_paid, 0) >= o.total THEN 'paid'::payment_status
    WHEN COALESCE(pt.total_paid, 0) > 0 THEN 'partial'::payment_status
    WHEN o.is_paid = true THEN 'paid'::payment_status
    ELSE 'unpaid'::payment_status
  END
FROM payment_totals pt
WHERE o.id = pt.order_id;

-- Also update orders without any payments
UPDATE orders
SET
  payment_status = CASE
    WHEN is_paid = true THEN 'paid'::payment_status
    ELSE 'unpaid'::payment_status
  END
WHERE amount_paid = 0 AND payment_status = 'unpaid';

-- Step 3: Set confirmed_at for orders that were confirmed but don't have timestamp
UPDATE orders
SET confirmed_at = updated_at
WHERE status IN ('confirmed', 'processing', 'shipped', 'delivered')
  AND confirmed_at IS NULL;

-- Step 4: Set completed_at for delivered orders
UPDATE orders
SET completed_at = updated_at
WHERE status = 'delivered'
  AND completed_at IS NULL;

-- Step 5: Set cancelled_at for cancelled orders
-- NOTE: 'refunded' and 'partially_refunded' statuses are removed in migration 0012
-- and those orders are migrated to 'delivered' status (payment tracking handles refund state)
UPDATE orders
SET cancelled_at = updated_at
WHERE status = 'cancelled'
  AND cancelled_at IS NULL;

-- Step 6: Backfill order_items unit_price from price where needed
UPDATE order_items
SET unit_price = price
WHERE unit_price IS NULL OR unit_price = 0;

-- Step 7: Calculate line_total for order items
UPDATE order_items
SET
  line_subtotal = unit_price * quantity,
  line_total = (unit_price * quantity) - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)
WHERE line_total = 0;
