# Kaka Malem — Roadmap

## Vision

A no-nonsense storefront builder for Afghan businesses. Sellers create a store, list products, and start selling on day one — with HesabPay handling online payments and cash on delivery as a fallback.

**Current stage:** Coming out of a crypto-marketplace pivot. The codebase has been gutted of crypto/escrow/Stripe and rebuilt around HesabPay + a Pro subscription model. Many features that were temporarily hidden during the pivot are coming back online.

---

## Already Built (foundation)

- [x] Multi-tenant architecture (seller storefronts via `[slug]` and custom domains)
- [x] Auth (Better Auth — email/password, Google, Facebook OAuth)
- [x] Product catalog (variants, categories, media library, bulk import/export)
- [x] Order management (creation, status tracking, refunds, shipments)
- [x] Customer accounts (auth, order history, wishlists, addresses)
- [x] Shipping zones and methods (unified delivery system)
- [x] Analytics dashboard (revenue, top products, heatmaps, geographic)
- [x] Custom domains with automatic SSL (Traefik + Let's Encrypt via Dokploy)
- [x] Dokploy deployment pipeline (Git auto-deploy, builds Dockerfile on VPS)
- [x] PostgreSQL 18 + PgBouncer + Drizzle ORM
- [x] Rich text editor (TipTap)
- [x] PWA / offline POS scaffolding (Dexie + Serwist)
- [x] Affiliate program (separate from seller payouts)
- [x] Reviews + ratings
- [x] HesabPay hosted checkout integration

---

## Phase 0 — Pivot Cleanup (DONE)

- [x] Stripe code + dependency removed
- [x] Crypto / USDT / TRC20 code removed
- [x] Escrow tables, disputes, seller earnings, seller payouts removed (schema + migration `drizzle/0045_*.sql`)
- [x] HesabPay restored as the sole online payment gateway in code paths
- [x] Admin nav links to deleted Disputes / Payouts pages removed
- [x] Subscription billing rewired around HesabPay invoices (no Stripe, no crypto)
- [x] CLAUDE.md, README.md rewritten to reflect new direction

---

## Phase 1 — Restore Disabled Features

Features that were commented out during the crypto pivot. All need to be turned back on and tested.

- [ ] **Pro upgrade button** on the seller billing page
- [ ] **Per-tenant payment gateway config UI** (let sellers turn HesabPay / COD on/off, pick the default at checkout)
- [ ] **Custom domain config UI** (let sellers connect their own domain from the store settings)
- [ ] **Offline POS** — POS register page, offline order recording, sync queue when back online
- [ ] Verify each re-enabled feature against the new schema + payment flow

---

## Phase 2 — HesabPay International (deferred)

HesabPay supports international payments. Wire it up if/when the customer base extends beyond Afghanistan. For now the platform is AFN-only and Afghan-only — no multi-currency, no international rails.

- [ ] Audit HesabPay international API surface (currencies, sandbox, webhook event shape, 3DS flow)
- [ ] Reintroduce multi-currency display + FX (the `crypto-baseline` tag has the sarafi.af integration to copy back)
- [ ] Update `lib/payments/hesabpay/client.ts` to handle international endpoints
- [ ] Detect buyer country → choose domestic vs international rail
- [ ] Test refund flow end-to-end with international cards

---

## Phase 3 — Subscription Billing Polish

- [ ] Cron: send invoice 7 days before subscription period ends
- [ ] In-app notification + email when invoice is generated
- [ ] Email when subscription is expiring soon
- [ ] Manual admin tools for handling expired-but-grace-period stores
- [ ] (later) Automatic downgrade after configurable grace period

---

## Phase 4 — Redesign

Full visual refresh with a quiet fintech aesthetic. No flashy colors, lots of whitespace, type-led design.

- [ ] Design language doc (colors, type scale, spacing, components, voice)
- [ ] Public landing page rebuild
- [ ] Storefront pages (home, product, listing, cart, checkout success)
- [ ] Seller dashboard (overview, products, orders, settings)
- [ ] Admin panel polish
- [ ] Mobile sweep (real-device testing on iOS Safari + Android Chrome)

---

## Phase 5 — Quality & Observability

- [ ] Test framework setup (Vitest or similar)
- [ ] Core path tests (checkout, order creation, subscription billing)
- [ ] Error monitoring (Sentry or similar)
- [ ] Performance budget for storefront pages (<2s on 4G)
- [ ] Lighthouse audit + fixes
- [ ] Database backup automation on the Dokploy host

---

## Backlog / Ideas

- [ ] Storefront themes / template gallery
- [ ] Built-in product photo editor (Sharp + cropping UI)
- [ ] WhatsApp order notifications to sellers
- [ ] Bulk order import for sellers running offline-first
- [ ] Loyalty program / store credits for repeat customers
- [ ] Sub-accounts for seller staff (role-based access — already in schema, needs UI polish)
- [ ] Storefront SEO improvements (structured data, OG image generation)
