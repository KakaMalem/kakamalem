-- Migration: Order Cancellation Stock Triggers
-- Description: Automatically restore/reduce stock when order status changes to/from cancelled

-- ============================================================================
-- HELPER FUNCTION: Calculate stock status based on quantity and threshold
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_stock_status(
    p_stock INTEGER,
    p_low_stock_threshold INTEGER DEFAULT 5,
    p_allow_backorder BOOLEAN DEFAULT FALSE
) RETURNS stock_status AS $$
BEGIN
    IF p_stock <= 0 THEN
        IF p_allow_backorder THEN
            RETURN 'on_backorder'::stock_status;
        ELSE
            RETURN 'out_of_stock'::stock_status;
        END IF;
    ELSIF p_stock <= p_low_stock_threshold THEN
        RETURN 'low_stock'::stock_status;
    ELSE
        RETURN 'in_stock'::stock_status;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- MAIN FUNCTION: Handle order status changes for inventory
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    current_stock INTEGER;
    new_stock INTEGER;
    movement_type inventory_movement_type;
    movement_reason TEXT;
    product_track_inventory BOOLEAN;
    product_low_stock_threshold INTEGER;
    product_allow_backorder BOOLEAN;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Case 1: Order is being cancelled - RESTORE stock
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        movement_type := 'released'::inventory_movement_type;
        movement_reason := format('Order %s cancelled', NEW.order_number);

        -- Iterate through all order items
        FOR item IN
            SELECT
                oi.id as order_item_id,
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.product_name,
                oi.variant_name,
                p.track_inventory,
                p.has_variants,
                p.low_stock_threshold,
                p.allow_backorder,
                p.stock as product_stock,
                pv.stock as variant_stock
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = NEW.id
        LOOP
            -- Skip if inventory tracking is disabled
            IF NOT item.track_inventory THEN
                CONTINUE;
            END IF;

            -- Update variant or product stock
            IF item.variant_id IS NOT NULL THEN
                -- Get current variant stock
                current_stock := item.variant_stock;
                new_stock := current_stock + item.quantity;

                -- Update variant stock
                UPDATE product_variants
                SET
                    stock = new_stock,
                    stock_status = calculate_stock_status(
                        new_stock,
                        item.low_stock_threshold,
                        item.allow_backorder
                    ),
                    updated_at = NOW()
                WHERE id = item.variant_id;
            ELSE
                -- Simple product (no variant)
                current_stock := item.product_stock;
                new_stock := current_stock + item.quantity;

                -- Update product stock
                UPDATE products
                SET
                    stock = new_stock,
                    updated_at = NOW()
                WHERE id = item.product_id;
            END IF;

            -- Create inventory movement record
            INSERT INTO inventory_movements (
                tenant_id,
                product_id,
                variant_id,
                type,
                quantity,
                previous_stock,
                new_stock,
                order_id,
                reason,
                created_at
            ) VALUES (
                NEW.tenant_id,
                item.product_id,
                item.variant_id,
                movement_type,
                item.quantity,  -- Positive for restoration
                current_stock,
                new_stock,
                NEW.id,
                movement_reason,
                NOW()
            );
        END LOOP;

    -- Case 2: Order is being UN-cancelled (restored) - REDUCE stock again
    ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
        movement_type := 'sale'::inventory_movement_type;
        movement_reason := format('Order %s restored from cancelled', NEW.order_number);

        -- Iterate through all order items
        FOR item IN
            SELECT
                oi.id as order_item_id,
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.product_name,
                oi.variant_name,
                p.track_inventory,
                p.has_variants,
                p.low_stock_threshold,
                p.allow_backorder,
                p.stock as product_stock,
                pv.stock as variant_stock
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = NEW.id
        LOOP
            -- Skip if inventory tracking is disabled
            IF NOT item.track_inventory THEN
                CONTINUE;
            END IF;

            -- Update variant or product stock
            IF item.variant_id IS NOT NULL THEN
                -- Get current variant stock
                current_stock := item.variant_stock;
                new_stock := GREATEST(0, current_stock - item.quantity);

                -- Update variant stock
                UPDATE product_variants
                SET
                    stock = new_stock,
                    stock_status = calculate_stock_status(
                        new_stock,
                        item.low_stock_threshold,
                        item.allow_backorder
                    ),
                    updated_at = NOW()
                WHERE id = item.variant_id;
            ELSE
                -- Simple product (no variant)
                current_stock := item.product_stock;
                new_stock := GREATEST(0, current_stock - item.quantity);

                -- Update product stock
                UPDATE products
                SET
                    stock = new_stock,
                    updated_at = NOW()
                WHERE id = item.product_id;
            END IF;

            -- Create inventory movement record
            INSERT INTO inventory_movements (
                tenant_id,
                product_id,
                variant_id,
                type,
                quantity,
                previous_stock,
                new_stock,
                order_id,
                reason,
                created_at
            ) VALUES (
                NEW.tenant_id,
                item.product_id,
                item.variant_id,
                movement_type,
                -item.quantity,  -- Negative for reduction
                current_stock,
                new_stock,
                NEW.id,
                movement_reason,
                NOW()
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Fire on order status updates
-- ============================================================================
DROP TRIGGER IF EXISTS order_status_inventory_trigger ON orders;

CREATE TRIGGER order_status_inventory_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_status_change();

-- ============================================================================
-- FUNCTION: Handle order returns/refunds - restore stock
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_order_return()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Only proceed if status changed to refunded or partially_refunded
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Only handle transition TO refunded states (not FROM)
    IF NEW.status NOT IN ('refunded', 'partially_refunded') THEN
        RETURN NEW;
    END IF;

    -- Don't restore stock if coming from cancelled (already restored)
    IF OLD.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- For partial refunds, we'd need a separate refund_items table
    -- For full refunds, restore all stock
    IF NEW.status = 'refunded' THEN
        FOR item IN
            SELECT
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                p.track_inventory,
                p.low_stock_threshold,
                p.allow_backorder,
                p.stock as product_stock,
                pv.stock as variant_stock
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = NEW.id
        LOOP
            IF NOT item.track_inventory THEN
                CONTINUE;
            END IF;

            IF item.variant_id IS NOT NULL THEN
                current_stock := item.variant_stock;
                new_stock := current_stock + item.quantity;

                UPDATE product_variants
                SET
                    stock = new_stock,
                    stock_status = calculate_stock_status(
                        new_stock,
                        item.low_stock_threshold,
                        item.allow_backorder
                    ),
                    updated_at = NOW()
                WHERE id = item.variant_id;
            ELSE
                current_stock := item.product_stock;
                new_stock := current_stock + item.quantity;

                UPDATE products
                SET
                    stock = new_stock,
                    updated_at = NOW()
                WHERE id = item.product_id;
            END IF;

            INSERT INTO inventory_movements (
                tenant_id,
                product_id,
                variant_id,
                type,
                quantity,
                previous_stock,
                new_stock,
                order_id,
                reason,
                created_at
            ) VALUES (
                NEW.tenant_id,
                item.product_id,
                item.variant_id,
                'return'::inventory_movement_type,
                item.quantity,
                current_stock,
                new_stock,
                NEW.id,
                format('Order %s refunded', NEW.order_number),
                NOW()
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Fire on order refunds
-- ============================================================================
DROP TRIGGER IF EXISTS order_return_inventory_trigger ON orders;

CREATE TRIGGER order_return_inventory_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status IN ('refunded', 'partially_refunded'))
    EXECUTE FUNCTION handle_order_return();

-- ============================================================================
-- Add index for faster inventory movement lookups by order
-- ============================================================================
CREATE INDEX IF NOT EXISTS inventory_movements_order_id_idx
    ON inventory_movements(order_id);
