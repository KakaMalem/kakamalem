# Kaka Malem - Build TODO

## Foundation

- [x] Set up project structure (`app/store/[slug]/`, `app/dashboard/`, `components/`, `lib/db/`)
- [x] Configure Drizzle ORM with Supabase connection
- [x] Create database schema (tenants, products, categories, carts, cart_items, orders, order_items)
- [x] Set up Supabase RLS policies for tenant isolation
- [x] Implement inventory & variant management system (product variants, stock tracking, inventory movements)
- [x] Implement shipping system (zones, methods, rate calculation, shipment tracking)
- [x] Implement storefront branding system (logo, tagline, social links, SEO metadata, analytics)
- [x] Implement commission/billing system (free tier, transaction tracking, grace period, forgiveness)
- [x] Implement comprehensive analytics system (daily/hourly snapshots, product/category performance, traffic sources, geographic sales, conversion events)
- [x] Implement authentication (Supabase Auth integration)

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
- [x] Build landing page (kakamalem.com home)
