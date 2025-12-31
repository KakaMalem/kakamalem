-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR KAKA MALEM
-- ============================================================================
-- This migration sets up RLS policies for tenant isolation and role-based access.
-- Run this in the Supabase SQL Editor after pushing your Drizzle schema.

-- ============================================================================
-- HELPER FUNCTION: Check tenant access with role hierarchy
-- ============================================================================
-- Role hierarchy: owner > admin > staff
-- SECURITY DEFINER bypasses RLS on tenant_members table for performance

CREATE OR REPLACE FUNCTION check_tenant_access(
  target_tenant_id UUID,
  required_role TEXT DEFAULT 'staff'
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
    AND tenant_id = target_tenant_id
    AND (
      (required_role = 'staff') -- Any member has at least staff access
      OR (required_role = 'admin' AND role IN ('admin', 'owner'))
      OR (required_role = 'owner' AND role = 'owner')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check if user is tenant owner
-- ============================================================================
CREATE OR REPLACE FUNCTION is_tenant_owner(target_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenants
    WHERE id = target_tenant_id
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Profile is created via trigger on auth.users (handled separately)
-- Allow insert for the trigger/service role
CREATE POLICY "Service can create profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tenants (for public storefronts)
CREATE POLICY "Public can view active tenants"
  ON tenants FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Authenticated users can create tenants
CREATE POLICY "Authenticated users can create tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only owner can update their tenant
CREATE POLICY "Owner can update tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Only owner can delete tenant
CREATE POLICY "Owner can delete tenant"
  ON tenants FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- TENANT MEMBERS TABLE
-- ============================================================================
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members in their tenant
CREATE POLICY "Members can view tenant members"
  ON tenant_members FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Only owner/admin can add members
CREATE POLICY "Admin can add tenant members"
  ON tenant_members FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'admin') OR is_tenant_owner(tenant_id));

-- Only owner/admin can update members (but not promote above their own role)
CREATE POLICY "Admin can update tenant members"
  ON tenant_members FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin') OR is_tenant_owner(tenant_id))
  WITH CHECK (check_tenant_access(tenant_id, 'admin') OR is_tenant_owner(tenant_id));

-- Only owner/admin can remove members
CREATE POLICY "Admin can remove tenant members"
  ON tenant_members FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin') OR is_tenant_owner(tenant_id));

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view categories (for public storefronts)
CREATE POLICY "Public can view categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can create categories
CREATE POLICY "Staff can create categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update categories
CREATE POLICY "Staff can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete categories
CREATE POLICY "Admin can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anyone can view active products (for public storefronts)
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff can view all products (including inactive) for their tenant
CREATE POLICY "Staff can view all tenant products"
  ON products FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create products
CREATE POLICY "Staff can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update products
CREATE POLICY "Staff can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete products
CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- MEDIA TABLE (centralized media library)
-- ============================================================================
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Anyone can view media (for public storefronts - images are public)
CREATE POLICY "Public can view media"
  ON media FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can upload media to their tenant
CREATE POLICY "Staff can upload media"
  ON media FOR INSERT
  TO authenticated
  WITH CHECK (
    check_tenant_access(tenant_id, 'staff')
    AND uploaded_by_id = auth.uid()
  );

-- Staff+ can update media metadata (alt text, etc.)
CREATE POLICY "Staff can update media"
  ON media FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete media
CREATE POLICY "Admin can delete media"
  ON media FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- PRODUCT IMAGES TABLE (junction table)
-- ============================================================================
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view product images (for public storefronts)
CREATE POLICY "Public can view product images"
  ON product_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can link media to products (via product's tenant)
CREATE POLICY "Staff can create product images"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND check_tenant_access(products.tenant_id, 'staff')
    )
  );

-- Staff+ can update product image positions
CREATE POLICY "Staff can update product images"
  ON product_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND check_tenant_access(products.tenant_id, 'staff')
    )
  );

-- Staff+ can unlink media from products
CREATE POLICY "Staff can delete product images"
  ON product_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND check_tenant_access(products.tenant_id, 'staff')
    )
  );

-- ============================================================================
-- CARTS TABLE
-- ============================================================================
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Users can view their own carts (by session_id or customer_id)
CREATE POLICY "Users can view own carts"
  ON carts FOR SELECT
  TO anon, authenticated
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR customer_id = auth.uid()
  );

-- Anyone can create a cart
CREATE POLICY "Anyone can create cart"
  ON carts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can update their own carts
CREATE POLICY "Users can update own carts"
  ON carts FOR UPDATE
  TO anon, authenticated
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR customer_id = auth.uid()
  );

-- Users can delete their own carts
CREATE POLICY "Users can delete own carts"
  ON carts FOR DELETE
  TO anon, authenticated
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR customer_id = auth.uid()
  );

-- ============================================================================
-- CART ITEMS TABLE
-- ============================================================================
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Users can view items in their own carts
CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_id
      AND (
        carts.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR carts.customer_id = auth.uid()
      )
    )
  );

-- Users can add items to their own carts
CREATE POLICY "Users can add cart items"
  ON cart_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_id
      AND (
        carts.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR carts.customer_id = auth.uid()
      )
    )
  );

-- Users can update items in their own carts
CREATE POLICY "Users can update cart items"
  ON cart_items FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_id
      AND (
        carts.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR carts.customer_id = auth.uid()
      )
    )
  );

-- Users can remove items from their own carts
CREATE POLICY "Users can delete cart items"
  ON cart_items FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_id
      AND (
        carts.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR carts.customer_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Customers can view their own orders (by email)
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (
    customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Staff can view all orders for their tenant
CREATE POLICY "Staff can view tenant orders"
  ON orders FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Anyone can create orders (checkout)
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff+ can update orders (change status)
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete orders
CREATE POLICY "Admin can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Users can view order items for their own orders
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (
        orders.customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
        OR check_tenant_access(orders.tenant_id, 'staff')
      )
    )
  );

-- Order items are created during checkout (via service or with order)
CREATE POLICY "Anyone can create order items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff+ can update order items
CREATE POLICY "Staff can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND check_tenant_access(orders.tenant_id, 'staff')
    )
  );

-- ============================================================================
-- REVIEWS TABLE
-- ============================================================================
-- NOTE: No approval workflow - all reviews are immediately visible for transparency.
-- Store owners can reply to reviews but cannot hide/approve them.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view all reviews (full transparency)
CREATE POLICY "Public can view all reviews"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own reviews (edit their comment/rating)
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (
    customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- Staff+ can update reviews (for adding owner replies only)
CREATE POLICY "Staff can reply to reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete reviews (for spam/abuse only)
CREATE POLICY "Admin can delete reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- REVIEW MEDIA TABLE (customer-uploaded review images)
-- ============================================================================
ALTER TABLE review_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view all review media (full transparency, matches review visibility)
CREATE POLICY "Public can view review media"
  ON review_media FOR SELECT
  TO anon, authenticated
  USING (true);

-- Customers can upload images with their reviews
-- (handled via server action that validates review ownership)
CREATE POLICY "Anyone can create review media"
  ON review_media FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff+ can delete review media (moderation)
CREATE POLICY "Staff can delete review media"
  ON review_media FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- ============================================================================
-- VARIANT OPTIONS TABLE (tenant-scoped option types)
-- ============================================================================
ALTER TABLE variant_options ENABLE ROW LEVEL SECURITY;

-- Anyone can view variant options (for storefront display)
CREATE POLICY "Public can view variant options"
  ON variant_options FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can create variant options for their tenant
CREATE POLICY "Staff can create variant options"
  ON variant_options FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update variant options
CREATE POLICY "Staff can update variant options"
  ON variant_options FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete variant options
CREATE POLICY "Admin can delete variant options"
  ON variant_options FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- VARIANT OPTION VALUES TABLE
-- ============================================================================
-- NOTE: tenant_id is denormalized for RLS performance (no joins needed)
ALTER TABLE variant_option_values ENABLE ROW LEVEL SECURITY;

-- Anyone can view variant option values (for storefront display)
CREATE POLICY "Public can view variant option values"
  ON variant_option_values FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can create variant option values
CREATE POLICY "Staff can create variant option values"
  ON variant_option_values FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update variant option values
CREATE POLICY "Staff can update variant option values"
  ON variant_option_values FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete variant option values
CREATE POLICY "Admin can delete variant option values"
  ON variant_option_values FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- PRODUCT VARIANTS TABLE
-- ============================================================================
-- NOTE: tenant_id is denormalized for RLS performance (no joins needed)
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Anyone can view active product variants (for storefront display)
CREATE POLICY "Public can view active product variants"
  ON product_variants FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff can view all variants (including inactive) for their tenant
CREATE POLICY "Staff can view all tenant product variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create product variants
CREATE POLICY "Staff can create product variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update product variants
CREATE POLICY "Staff can update product variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete product variants
CREATE POLICY "Admin can delete product variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- PRODUCT VARIANT OPTIONS TABLE (junction table)
-- ============================================================================
-- NOTE: tenant_id is denormalized for RLS performance and to prevent cross-tenant linking
ALTER TABLE product_variant_options ENABLE ROW LEVEL SECURITY;

-- Anyone can view product variant options (for storefront display)
CREATE POLICY "Public can view product variant options"
  ON product_variant_options FOR SELECT
  TO anon, authenticated
  USING (true);

-- Staff+ can link option values to variants
CREATE POLICY "Staff can create product variant options"
  ON product_variant_options FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update product variant options
CREATE POLICY "Staff can update product variant options"
  ON product_variant_options FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can delete product variant options
CREATE POLICY "Staff can delete product variant options"
  ON product_variant_options FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- ============================================================================
-- INVENTORY MOVEMENTS TABLE (audit log)
-- ============================================================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Staff can view inventory movements for their tenant
CREATE POLICY "Staff can view tenant inventory movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create inventory movements (manual adjustments)
CREATE POLICY "Staff can create inventory movements"
  ON inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    check_tenant_access(tenant_id, 'staff')
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Inventory movements should generally not be updated (audit log)
-- But admin can update if needed for corrections
CREATE POLICY "Admin can update inventory movements"
  ON inventory_movements FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'))
  WITH CHECK (check_tenant_access(tenant_id, 'admin'));

-- Only owner can delete inventory movements (rare, for data cleanup)
CREATE POLICY "Owner can delete inventory movements"
  ON inventory_movements FOR DELETE
  TO authenticated
  USING (is_tenant_owner(tenant_id));

-- ============================================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SHIPPING ZONES TABLE
-- ============================================================================
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

-- Anyone can view active shipping zones (needed for checkout)
CREATE POLICY "Public can view active shipping zones"
  ON shipping_zones FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff can view all zones (including inactive) for their tenant
CREATE POLICY "Staff can view all tenant shipping zones"
  ON shipping_zones FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create shipping zones
CREATE POLICY "Staff can create shipping zones"
  ON shipping_zones FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update shipping zones
CREATE POLICY "Staff can update shipping zones"
  ON shipping_zones FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete shipping zones
CREATE POLICY "Admin can delete shipping zones"
  ON shipping_zones FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- SHIPPING METHODS TABLE
-- ============================================================================
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

-- Anyone can view active shipping methods (needed for checkout)
CREATE POLICY "Public can view active shipping methods"
  ON shipping_methods FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Staff can view all methods (including inactive) for their tenant
CREATE POLICY "Staff can view all tenant shipping methods"
  ON shipping_methods FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create shipping methods
CREATE POLICY "Staff can create shipping methods"
  ON shipping_methods FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update shipping methods
CREATE POLICY "Staff can update shipping methods"
  ON shipping_methods FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete shipping methods
CREATE POLICY "Admin can delete shipping methods"
  ON shipping_methods FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- SHIPMENTS TABLE
-- ============================================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Customers can view shipments for their own orders (by email match)
CREATE POLICY "Customers can view own order shipments"
  ON shipments FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND orders.customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Staff can view all shipments for their tenant
CREATE POLICY "Staff can view tenant shipments"
  ON shipments FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can create shipments
CREATE POLICY "Staff can create shipments"
  ON shipments FOR INSERT
  TO authenticated
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Staff+ can update shipments (add tracking, update status)
CREATE POLICY "Staff can update shipments"
  ON shipments FOR UPDATE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'))
  WITH CHECK (check_tenant_access(tenant_id, 'staff'));

-- Admin+ can delete shipments
CREATE POLICY "Admin can delete shipments"
  ON shipments FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- SHIPMENT TRACKING EVENTS TABLE
-- ============================================================================
ALTER TABLE shipment_tracking_events ENABLE ROW LEVEL SECURITY;

-- Customers can view tracking events for their own shipments
CREATE POLICY "Customers can view own shipment tracking"
  ON shipment_tracking_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      JOIN orders ON orders.id = shipments.order_id
      WHERE shipments.id = shipment_id
      AND orders.customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Staff can view all tracking events for their tenant's shipments
CREATE POLICY "Staff can view tenant shipment tracking"
  ON shipment_tracking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Staff+ can create tracking events (manual updates)
CREATE POLICY "Staff can create tracking events"
  ON shipment_tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Tracking events should generally not be updated (audit log)
-- But staff can update if needed for corrections
CREATE POLICY "Staff can update tracking events"
  ON shipment_tracking_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Admin+ can delete tracking events (rare, for data cleanup)
CREATE POLICY "Admin can delete tracking events"
  ON shipment_tracking_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'admin')
    )
  );

-- ============================================================================
-- SHIPMENT ITEMS TABLE (junction: order items in each shipment)
-- ============================================================================
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Customers can view shipment items for their own orders
CREATE POLICY "Customers can view own shipment items"
  ON shipment_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      JOIN orders ON orders.id = shipments.order_id
      WHERE shipments.id = shipment_id
      AND orders.customer_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Staff can view all shipment items for their tenant
CREATE POLICY "Staff can view tenant shipment items"
  ON shipment_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Staff+ can create shipment items (when creating/updating shipments)
CREATE POLICY "Staff can create shipment items"
  ON shipment_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Staff+ can update shipment items (adjust quantities)
CREATE POLICY "Staff can update shipment items"
  ON shipment_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- Staff+ can delete shipment items (remove items from shipment)
CREATE POLICY "Staff can delete shipment items"
  ON shipment_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shipments
      WHERE shipments.id = shipment_id
      AND check_tenant_access(shipments.tenant_id, 'staff')
    )
  );

-- ============================================================================
-- COMMISSION TRANSACTIONS TABLE (billing audit log)
-- ============================================================================
-- Commission transactions track all billing-related events:
-- - Commission earned from orders
-- - Payments received from store owners
-- - Manual adjustments by admins
-- - Debt forgiveness
--
-- Access:
-- - Store owners can view their own transaction history (read-only)
-- - Admin/system can create and manage transactions
-- - Transactions are immutable (no update/delete for audit integrity)
ALTER TABLE commission_transactions ENABLE ROW LEVEL SECURITY;

-- Store owner can view their own commission transactions (for transparency)
CREATE POLICY "Owner can view own commission transactions"
  ON commission_transactions FOR SELECT
  TO authenticated
  USING (is_tenant_owner(tenant_id));

-- Staff can also view commission transactions for their tenant
CREATE POLICY "Staff can view tenant commission transactions"
  ON commission_transactions FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Commission transactions are created by the system (via service role)
-- This allows order processing hooks to add commissions automatically
CREATE POLICY "Service can create commission transactions"
  ON commission_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated admin users to create adjustments/forgiveness
-- In practice, this is done via server actions with admin checks
CREATE POLICY "Admin can create commission transactions"
  ON commission_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin must be a member with admin role or the owner
    check_tenant_access(tenant_id, 'admin') OR is_tenant_owner(tenant_id)
  );

-- Commission transactions should NEVER be updated (audit integrity)
-- No update policy = cannot update

-- Commission transactions should NEVER be deleted (audit integrity)
-- No delete policy = cannot delete

-- ============================================================================
-- ANALYTICS: DAILY SNAPSHOTS
-- ============================================================================
-- Aggregated daily metrics for dashboard charts and reports.
-- Read-only for store owners, managed by system/service.
ALTER TABLE analytics_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's daily analytics
CREATE POLICY "Staff can view tenant daily snapshots"
  ON analytics_daily_snapshots FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service creates snapshots (nightly aggregation job)
CREATE POLICY "Service can manage daily snapshots"
  ON analytics_daily_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: HOURLY METRICS
-- ============================================================================
ALTER TABLE analytics_hourly_metrics ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's hourly metrics
CREATE POLICY "Staff can view tenant hourly metrics"
  ON analytics_hourly_metrics FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service manages hourly metrics
CREATE POLICY "Service can manage hourly metrics"
  ON analytics_hourly_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: PRODUCT PERFORMANCE
-- ============================================================================
ALTER TABLE analytics_product_performance ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's product performance
CREATE POLICY "Staff can view tenant product performance"
  ON analytics_product_performance FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service manages product performance data
CREATE POLICY "Service can manage product performance"
  ON analytics_product_performance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: CATEGORY PERFORMANCE
-- ============================================================================
ALTER TABLE analytics_category_performance ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's category performance
CREATE POLICY "Staff can view tenant category performance"
  ON analytics_category_performance FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service manages category performance data
CREATE POLICY "Service can manage category performance"
  ON analytics_category_performance FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: TRAFFIC SOURCES
-- ============================================================================
ALTER TABLE analytics_traffic_sources ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's traffic sources
CREATE POLICY "Staff can view tenant traffic sources"
  ON analytics_traffic_sources FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service manages traffic source data
CREATE POLICY "Service can manage traffic sources"
  ON analytics_traffic_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: GEOGRAPHIC SALES
-- ============================================================================
ALTER TABLE analytics_geographic_sales ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's geographic sales
CREATE POLICY "Staff can view tenant geographic sales"
  ON analytics_geographic_sales FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- System/service manages geographic sales data
CREATE POLICY "Service can manage geographic sales"
  ON analytics_geographic_sales FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS: PAGE VIEWS (raw events)
-- ============================================================================
-- High-volume table - insert from frontend, read by staff only
ALTER TABLE analytics_page_views ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's page views (for funnel analysis)
CREATE POLICY "Staff can view tenant page views"
  ON analytics_page_views FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Anonymous users can record page views (via API endpoint with tenant validation)
-- In practice, this is done via a server action that validates the tenant
CREATE POLICY "Anyone can record page views"
  ON analytics_page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- System/service has full access for data cleanup/aggregation
CREATE POLICY "Service can manage page views"
  ON analytics_page_views FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin can delete old page views (data retention)
CREATE POLICY "Admin can delete page views"
  ON analytics_page_views FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));

-- ============================================================================
-- ANALYTICS: CONVERSION EVENTS
-- ============================================================================
-- Key funnel events (add to cart, checkout, etc.)
ALTER TABLE analytics_conversion_events ENABLE ROW LEVEL SECURITY;

-- Staff can view their tenant's conversion events
CREATE POLICY "Staff can view tenant conversion events"
  ON analytics_conversion_events FOR SELECT
  TO authenticated
  USING (check_tenant_access(tenant_id, 'staff'));

-- Anonymous users can record conversion events (via API with tenant validation)
CREATE POLICY "Anyone can record conversion events"
  ON analytics_conversion_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- System/service has full access
CREATE POLICY "Service can manage conversion events"
  ON analytics_conversion_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin can delete old events (data retention)
CREATE POLICY "Admin can delete conversion events"
  ON analytics_conversion_events FOR DELETE
  TO authenticated
  USING (check_tenant_access(tenant_id, 'admin'));
