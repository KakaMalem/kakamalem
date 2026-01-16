-- Migration: Backfill stock for historically cancelled orders
-- Description: One-time fix for orders cancelled before triggers were added
-- Run this AFTER 0001_order_cancellation_stock_triggers.sql

-- ============================================================================
-- This script finds all cancelled orders that don't have a corresponding
-- 'released' inventory movement and restores their stock
-- ============================================================================

DO $$
DECLARE
    cancelled_order RECORD;
    item RECORD;
    current_stock INTEGER;
    new_stock INTEGER;
    already_processed BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting backfill of cancelled orders stock...';

    -- Find all cancelled orders
    FOR cancelled_order IN
        SELECT o.id, o.tenant_id, o.order_number
        FROM orders o
        WHERE o.status = 'cancelled'
        ORDER BY o.created_at
    LOOP
        -- Check if this order already has 'released' inventory movements
        SELECT EXISTS(
            SELECT 1 FROM inventory_movements im
            WHERE im.order_id = cancelled_order.id
            AND im.type = 'released'
        ) INTO already_processed;

        IF already_processed THEN
            RAISE NOTICE 'Order % already processed, skipping', cancelled_order.order_number;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Processing cancelled order: %', cancelled_order.order_number;

        -- Process each item in the order
        FOR item IN
            SELECT
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.product_name,
                p.track_inventory,
                p.low_stock_threshold,
                p.allow_backorder,
                p.stock as product_stock,
                pv.stock as variant_stock
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = cancelled_order.id
        LOOP
            -- Skip if inventory tracking is disabled
            IF NOT item.track_inventory THEN
                CONTINUE;
            END IF;

            -- Update variant or product stock
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

                RAISE NOTICE '  Restored % units to variant (% -> %)',
                    item.quantity, current_stock, new_stock;
            ELSE
                current_stock := item.product_stock;
                new_stock := current_stock + item.quantity;

                UPDATE products
                SET
                    stock = new_stock,
                    updated_at = NOW()
                WHERE id = item.product_id;

                RAISE NOTICE '  Restored % units to product "%" (% -> %)',
                    item.quantity, item.product_name, current_stock, new_stock;
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
                cancelled_order.tenant_id,
                item.product_id,
                item.variant_id,
                'released'::inventory_movement_type,
                item.quantity,
                current_stock,
                new_stock,
                cancelled_order.id,
                format('Backfill: Order %s was cancelled', cancelled_order.order_number),
                NOW()
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Backfill completed!';
END $$;

-- ============================================================================
-- Also fix any fully refunded orders that don't have 'return' movements
-- ============================================================================

DO $$
DECLARE
    refunded_order RECORD;
    item RECORD;
    current_stock INTEGER;
    new_stock INTEGER;
    already_processed BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting backfill of refunded orders stock...';

    -- Find all fully refunded orders (not cancelled - those are handled above)
    FOR refunded_order IN
        SELECT o.id, o.tenant_id, o.order_number
        FROM orders o
        WHERE o.status = 'refunded'
        ORDER BY o.created_at
    LOOP
        -- Check if this order already has 'return' inventory movements
        SELECT EXISTS(
            SELECT 1 FROM inventory_movements im
            WHERE im.order_id = refunded_order.id
            AND im.type = 'return'
        ) INTO already_processed;

        IF already_processed THEN
            RAISE NOTICE 'Order % already processed, skipping', refunded_order.order_number;
            CONTINUE;
        END IF;

        RAISE NOTICE 'Processing refunded order: %', refunded_order.order_number;

        -- Process each item in the order
        FOR item IN
            SELECT
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.product_name,
                p.track_inventory,
                p.low_stock_threshold,
                p.allow_backorder,
                p.stock as product_stock,
                pv.stock as variant_stock
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE oi.order_id = refunded_order.id
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

                RAISE NOTICE '  Restored % units to variant (% -> %)',
                    item.quantity, current_stock, new_stock;
            ELSE
                current_stock := item.product_stock;
                new_stock := current_stock + item.quantity;

                UPDATE products
                SET
                    stock = new_stock,
                    updated_at = NOW()
                WHERE id = item.product_id;

                RAISE NOTICE '  Restored % units to product "%" (% -> %)',
                    item.quantity, item.product_name, current_stock, new_stock;
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
                refunded_order.tenant_id,
                item.product_id,
                item.variant_id,
                'return'::inventory_movement_type,
                item.quantity,
                current_stock,
                new_stock,
                refunded_order.id,
                format('Backfill: Order %s was refunded', refunded_order.order_number),
                NOW()
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Refund backfill completed!';
END $$;
