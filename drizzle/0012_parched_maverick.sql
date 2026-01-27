-- Migration: Separate order status (fulfillment) from payment status
-- Removes "refunded" and "partially_refunded" from order_status enum
-- Adds "returned" for physical returns
-- Payment status now handles refund tracking

-- Step 0: Drop triggers that depend on the status column
DROP TRIGGER IF EXISTS order_status_inventory_trigger ON orders;--> statement-breakpoint
DROP TRIGGER IF EXISTS order_return_inventory_trigger ON orders;--> statement-breakpoint

-- Step 1: Convert column to text (required for enum recreation)
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint

-- Step 2: Migrate existing orders with refunded/partially_refunded status to "delivered"
-- (They were fulfilled before being refunded, payment status tracks the refund)
UPDATE "orders" SET "status" = 'delivered' WHERE "status" IN ('refunded', 'partially_refunded');--> statement-breakpoint

-- Step 3: Drop old enum and create new one
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled');--> statement-breakpoint

-- Step 4: Convert column back to enum
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint

-- Step 5: Recreate the cancellation trigger (restores stock when order is cancelled)
CREATE TRIGGER order_status_inventory_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_status_change();--> statement-breakpoint

-- Step 6: Update return trigger function to use new 'returned' status instead of 'refunded'
CREATE OR REPLACE FUNCTION handle_order_return()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Only proceed if status changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Only handle transition TO returned status
    IF NEW.status != 'returned' THEN
        RETURN NEW;
    END IF;

    -- Don't restore stock if coming from cancelled (already restored)
    IF OLD.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- Restore stock for returned items
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
            format('Order %s returned', NEW.order_number),
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Step 7: Recreate the return trigger with new status
CREATE TRIGGER order_return_inventory_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status = 'returned')
    EXECUTE FUNCTION handle_order_return();
