# Kaka Malem — Roadmap

## Vision

Become the trust layer for cross-border trade — a crypto-native escrow marketplace connecting Western buyers with white-label sellers sourcing from Chinese factories. Market-neutral, censorship-resistant, no banks, no fiat.

**Current stage:** Pivoting from Afghan-market shop builder SaaS to global crypto escrow marketplace. Core e-commerce infrastructure is complete and carries over. The escrow system is what needs to be built.

---

## Already Built (carries over from original platform)

- [x] Multitenant architecture (seller storefronts via `[slug]`)
- [x] Auth system (email/password, Google, Facebook OAuth)
- [x] Product catalog (products, variants, categories, media library)
- [x] Bulk product import/export with pricing (CSV, Excel, ZIP)
- [x] Order management (creation, status tracking, order items)
- [x] Customer accounts (auth, order history, wishlists, addresses)
- [x] Shipping zones and methods
- [x] USDT crypto payments (TRC20, ERC20, BEP20) — custodial wallet approach
- [x] Analytics dashboard
- [x] Admin panel (platform management, store oversight)
- [x] Custom domains with automatic SSL (Caddy)
- [x] Docker + blue-green zero-downtime deployment pipeline
- [x] PostgreSQL 18 + PgBouncer + Drizzle ORM

> **Legacy:** Stripe and HesabPay integrations remain intact for one existing client. Do not remove. New development targets the escrow model only.

---

## Phase 1: Pivot Foundation

_Goal: Reorient the platform toward the escrow marketplace model without breaking existing infrastructure_

### Branding & Landing Page

- [ ] Rewrite landing page — new value prop (escrow, crypto, cross-border, "UK-based operating in Afghanistan")
- [ ] "How it works" section for buyers and sellers
- [ ] Trust signals: escrow guarantee, dispute resolution, no banks
- [ ] Seller signup CTA ("Start selling in minutes")

### Seller Onboarding

- [ ] Update store creation flow — framed as "seller storefront" not generic "store"
- [ ] Add sourcing fields to product form (supplier URL, supplier SKU — hidden from buyers)
- [ ] Seller public profile page (bio, location, what they sell, trust score placeholder)
- [ ] Disable POS/offline sales from seller dashboard (not relevant)

### Checkout — Crypto Only

- [ ] Remove fiat payment options from buyer-facing checkout (COD, bank transfer, mobile money)
- [ ] Keep HesabPay/Stripe wired up in code but hidden from new storefront checkout
- [ ] Supported at checkout: USDT (TRC20, ERC20, BEP20) and USDC (ERC20)
- [ ] Checkout shows wallet QR + address + expected amount
- [ ] Payment confirmation via tx hash submission (existing flow) + webhook detection

---

## Phase 2: Escrow System

_Goal: Build the core product — this is what makes Kaka Malem different from everything else_

### Database Schema

- [ ] `escrow_transactions` — per-order escrow record
  - `orderId`, `tenantId`, `buyerId`, `sellerId`
  - `amount`, `currency` (usdt/usdc), `network` (trc20/erc20/bep20)
  - `walletAddress` — platform escrow address used
  - `txHash` — buyer's payment transaction hash
  - `status` — see status enum below
  - `autoReleaseAt` — timestamp for auto-release (set when in_transit)
  - `platformFee`, `platformFeePercent` — fee snapshot at time of payment
  - `releasedAt`, `releasedTo` — audit
- [ ] `disputes` — dispute records
  - `escrowTransactionId`, `openedBy` (buyer/seller)
  - `reason`, `status` (open/resolved_buyer/resolved_seller)
  - `resolvedBy` (admin), `resolvedAt`, `resolutionNote`
- [ ] `dispute_messages` — threaded evidence/messaging per dispute
  - `disputeId`, `authorId`, `role` (buyer/seller/admin)
  - `body`, `attachments` (image URLs), `createdAt`

### Escrow Status Flow

```
pending        → Order placed, waiting for buyer payment
funded         → Crypto received and confirmed in escrow wallet
in_transit     → Seller uploaded tracking number, shipped
delivered      → Buyer clicked "Confirm delivery"
released       → Funds sent to seller wallet (minus platform fee)
disputed       → Buyer or seller opened dispute, funds frozen
resolved_buyer → Admin ruled for buyer, full refund sent
resolved_seller→ Admin ruled for seller, funds released to seller
expired        → Auto-released to seller after 30-day timeout
```

### Escrow Logic (`lib/escrow/`)

- [ ] `hold()` — mark order as funded when payment confirmed
- [ ] `release()` — transfer funds to seller wallet minus fee, update status
- [ ] `refund()` — return funds to buyer wallet
- [ ] `openDispute()` — freeze funds, create dispute record, notify admin
- [ ] `resolveDispute()` — admin calls release() or refund() with reason
- [ ] `autoRelease()` — cron job, scans funded/in_transit orders past timeout

### Buyer Flow

- [ ] Order status page — live escrow status (funded → in_transit → delivered)
- [ ] "Confirm delivery" button — triggers escrow release
- [ ] "Open dispute" button — available after seller marks shipped, before auto-release
- [ ] Dispute form — reason, description, photo evidence upload
- [ ] Notification when funds are refunded or released

### Seller Flow

- [ ] Orders dashboard — escrow status column per order
- [ ] "Mark as shipped" + tracking number input → triggers `in_transit`
- [ ] Earnings dashboard — pending escrow, released, platform fees deducted
- [ ] Withdrawal section — seller sets their payout wallet address
- [ ] Notification when funds are released to their wallet

### Admin — Dispute Resolution

- [ ] Dispute queue in admin panel
- [ ] View full dispute: buyer claim, seller response, tracking info, evidence photos
- [ ] "Release to seller" / "Refund to buyer" buttons with required reason field
- [ ] Dispute resolution audit log (who decided, when, why)
- [ ] Platform fee revenue dashboard (total fees collected, by period)

### Platform Fee

- [ ] Fee % configurable in admin settings (default: 5%)
- [ ] Fee deducted automatically from escrow on release — seller receives net amount
- [ ] Fee snapshot stored on `escrow_transactions` at time of payment (fee can't change retroactively)
- [ ] Platform fee wallet address configurable in admin

---

## Phase 3: Trust & Marketplace Layer

_Goal: Give buyers confidence to shop and give sellers tools to build reputation_

### Seller Trust System

- [ ] Seller trust score — calculated from: order completion rate, dispute rate, avg. response time
- [ ] "Kaka Malem Verified" badge — manual admin approval
- [ ] Seller response rate and avg. response time shown on storefront
- [ ] Order history count shown publicly (e.g. "127 completed orders")

### Buyer Reviews

- [ ] Post-delivery review form (1-5 stars, text, optional photos)
- [ ] Verified purchase only — review unlocked after escrow released
- [ ] Seller can reply to reviews
- [ ] Review summary on product page and seller profile

### Marketplace Discovery

- [ ] Global browse page — products across all sellers
- [ ] Search and filter (category, price range, seller rating, location)
- [ ] Featured listings (admin-promoted)
- [ ] "New arrivals" and trending sections

---

## Phase 4: AI Features

_Goal: Scale trust and dispute resolution without a large ops team_

### Listing Generation

- [ ] AI-generated product description from supplier images + spec input
- [ ] Auto-translate Chinese product specs → English
- [ ] Price suggestion based on category benchmarks

### Dispute Assist

- [ ] AI summarizes dispute for admin (buyer claim + seller response in one paragraph)
- [ ] Suggests likely outcome based on evidence and past cases
- [ ] Auto-translate messages between Chinese-speaking sellers and English-speaking buyers

### Supplier Verification (Future)

- [ ] Reverse image search on product photos (flag reused/stock images)
- [ ] Factory document analysis (business license, certifications)
- [ ] Risk score per listing (new seller + unusual price = flag for review)

---

## Phase 5: Scale & Compliance

_Goal: Build sustainable infrastructure for growing volume_

### Multi-Coin Expansion

- [ ] BTC support — escrow amount denominated in BTC, not USD
- [ ] ETH support — same as BTC
- [ ] Automatic stablecoin preference at checkout (USDT/USDC shown first)

### KYC (Selective, Seller-Side)

- [ ] Optional seller KYC for "Verified" badge and higher withdrawal limits
- [ ] Document upload (passport, business registration)
- [ ] No mandatory KYC for buyers — preserve privacy

### Legal

- [ ] Terms of Service + Escrow Agreement (UK jurisdiction)
- [ ] Privacy Policy (no personal data sold, GDPR-lite)
- [ ] Public dispute resolution policy

### Infrastructure

- [ ] Escrow wallet monitoring — balance alerts, sweep large holdings to cold storage
- [ ] Multi-region redundancy (Afghanistan primary + failover node)
- [ ] Rate limiting on checkout and wallet endpoints
- [ ] Fraud detection (multiple accounts, suspicious tx patterns)

---

## Deferred / Not Relevant to New Direction

These exist in the codebase for the legacy Afghan-market SaaS client. They are **not being removed** but are **not being developed further**:

- POS / offline sales system
- HesabPay integration
- Stripe subscriptions and billing
- COD, bank transfer, mobile money payments
- Subscription tiers (free/pro trial model)
- AFN currency as default

---

## Priority Order

1. **Phase 1** — Landing page + crypto-only checkout
2. **Phase 2** — Escrow system (this is the product)
3. **Phase 3** — Trust and marketplace layer
4. **Phase 4** — AI features
5. **Phase 5** — Scale and compliance
