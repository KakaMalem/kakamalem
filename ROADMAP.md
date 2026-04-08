# Kaka Malem — Roadmap

## Vision

Become the trust layer for cross-border trade — a crypto-native escrow platform connecting Western buyers with white-label sellers sourcing from Chinese factories. Market-neutral, censorship-resistant, no banks, no fiat.

**Current stage:** Phase 1 and 2 complete. Core escrow system is live. Platform is functional for real sellers and buyers.

---

## Already Built (from original platform)

- [x] Multitenant architecture (seller storefronts via `[slug]`)
- [x] Auth system (email/password, Google, Facebook OAuth)
- [x] Product catalog (products, variants, categories, media library)
- [x] Bulk product import/export with pricing (CSV, Excel, ZIP)
- [x] Order management (creation, status tracking, order items)
- [x] Customer accounts (auth, order history, wishlists, addresses)
- [x] Shipping zones and methods
- [x] Analytics dashboard
- [x] Custom domains with automatic SSL (Caddy)
- [x] Docker + blue-green zero-downtime deployment pipeline
- [x] PostgreSQL 18 + PgBouncer + Drizzle ORM
- [x] Rich text editor with H1-H6 headings and HTML source toggle

> **Legacy:** Stripe and HesabPay integrations remain intact for existing clients. Do not remove. New development targets the escrow model only.

---

## Phase 1: Pivot Foundation (COMPLETE)

- [x] Landing page rewritten — escrow value prop, how it works, comparison table, "UK-based operating in Afghanistan"
- [x] Seller onboarding reframed — "Start selling" not "Create a store"
- [x] Default payment gateway changed to crypto_usdt (TRC20) for new stores
- [x] Fiat payment options (COD, bank transfer, mobile money) removed from new store checkout
- [x] Legacy stores keep their existing Stripe/HesabPay/COD configs untouched
- [x] Payment settings page hidden from seller dashboard (legacy configs still work via DB)
- [x] Crypto payment page redesigned — Stripe-style clean layout, no nav/footer, responsive two-column on desktop
- [x] TRC20 as the only network — ERC20/BEP20 removed from checkout
- [x] Auto-detection via TronGrid (no manual tx hash submission needed)
- [x] Checkout page cleaned up — removed "Back to cart" link, removed "Secure Checkout" badge

---

## Phase 2: Escrow System (COMPLETE)

### Schema & Core Logic

- [x] `escrow_transactions`, `disputes`, `dispute_messages` tables + migration
- [x] Escrow core logic: `createEscrow()`, `fundEscrow()`, `markShipped()`, `confirmDeliveryAndRelease()`, `openDispute()`, `resolveDispute()`, `processAutoReleases()`
- [x] Escrow auto-created on crypto checkout (wired into `createOrderPaymentSession`)
- [x] 5% platform fee snapshotted at payment time, deducted on release
- [x] 30-day auto-release timer set when seller marks shipped

### Buyer Flow

- [x] Escrow status card on order detail page (funded → in_transit → delivered → released)
- [x] "Confirm Delivery" button — releases funds to seller
- [x] "Open Dispute" dialog — reason + description, freezes funds
- [x] Auto-release countdown visible to buyer

### Seller Flow

- [x] Escrow card on seller order detail page — status, financial breakdown (amount → fee → payout)
- [x] "Mark as Shipped" dialog — tracking number + carrier input
- [x] Earnings dashboard (existing) — now wired to escrow releases via `creditSellerEarnings()`
- [x] Payout wallet configuration (existing earnings page)

### Admin

- [x] Dispute queue at `/admin/disputes` — view evidence, message parties, resolve (refund buyer or release to seller)
- [x] Payout processing at `/admin/payouts` — mark processing, complete with tx hash, reject with reason
- [x] Dispute and payout nav items added to admin sidebar + mobile nav

### Financial Security

- [x] Race condition fixed — payout requests use `SELECT ... FOR UPDATE` row locking
- [x] TRC20 wallet address validation (regex: starts with T, 34 chars, base58)
- [x] Database CHECK constraints — `available >= 0`, `pending >= 0`, `reserved >= 0`
- [x] $0.50 USDT withdrawal fee (covers TRC20 gas)
- [x] Custodial wallet model — no private keys on server, all transfers manual

### Cron Jobs

- [x] `/api/cron/escrow-auto-release` — releases in_transit escrows past 30-day deadline
- [x] `/api/cron/mature-earnings` — moves pending seller earnings to available after 7-day hold
- [x] Both protected by `CRON_SECRET` env var, running hourly on server

---

## Phase 3: Trust & Polish

_Goal: Build buyer confidence and seller reputation_

### Seller Trust

- [ ] Seller trust score — calculated from: order completion rate, dispute rate
- [ ] "Kaka Malem Verified" badge — manual admin approval
- [ ] Order count shown publicly on storefront (e.g. "127 completed orders")

### Buyer Reviews

- [ ] Post-delivery review form (1-5 stars, text, optional photos)
- [ ] Verified purchase only — review unlocked after escrow released
- [ ] Seller can reply to reviews

### Notifications

- [ ] Email notifications for key escrow events (funded, shipped, released, disputed)
- [ ] Seller notification when payout is completed

### Legal

- [x] Terms of Service page (`/terms`)
- [x] Privacy Policy page (`/privacy`)
- [x] Update terms to include escrow agreement and dispute resolution policy

---

## Phase 4: AI Features

_Goal: Scale trust and dispute resolution without a large ops team_

- [ ] AI-generated product descriptions from supplier images + specs
- [ ] AI dispute summarization for admin (buyer claim + seller response in one paragraph)
- [ ] Auto-translate messages between Chinese sellers and English buyers
- [ ] Risk score per listing (new seller + unusual price = flag)

---

## Phase 5: Scale & Compliance

_Goal: Sustainable infrastructure for growing volume_

- [ ] Multi-coin expansion (BTC, ETH — price locked at payment time)
- [ ] Optional seller KYC for "Verified" badge and higher limits
- [ ] Escrow wallet monitoring — balance alerts, cold storage sweep
- [ ] Multi-region redundancy (Afghanistan primary + failover)
- [ ] Rate limiting and fraud detection on checkout

---

## Deferred / Legacy

These exist in the codebase for existing clients. **Not being removed, not being developed further:**

- POS / offline sales system
- HesabPay integration
- Stripe subscriptions and billing
- COD, bank transfer, mobile money payments
- Subscription tiers (free/pro trial model)
- AFN currency as default
- Payment settings page (hidden from nav, configs remain in DB)
