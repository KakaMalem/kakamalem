# Kaka Malem - Build TODO

## Foundation

- [ ] Set up project structure (`app/store/[slug]/`, `app/dashboard/`, `components/`, `lib/db/`)
- [ ] Configure Drizzle ORM with Supabase connection
- [ ] Create database schema (tenants, users, products, categories, carts, cart_items, orders, order_items)
- [ ] Set up Supabase RLS policies for tenant isolation
- [ ] Implement authentication (Supabase Auth integration)

## Dashboard (Store Owner)

- [ ] Build dashboard layout and navigation
- [ ] Create store management pages (create store, store settings, branding)
- [ ] Build product management (CRUD for products, categories, images)
- [ ] Set up Supabase Storage for product images and shop assets

## Storefront (Customer-facing)

- [ ] Build public storefront (`app/store/[slug]/`) with product listing and detail pages
- [ ] Implement cart functionality (Zustand store, add/remove/update items)
- [ ] Build checkout flow (customer info, order creation)

## Orders & Landing

- [ ] Create order management for store owners (view orders, update status)
- [ ] Build landing page (kakamalem.com home)
