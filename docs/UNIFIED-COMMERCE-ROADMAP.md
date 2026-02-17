# Unified Commerce Architecture Roadmap

> **Version:** 1.0.0
> **Status:** Draft
> **Last Updated:** January 2026
> **Authors:** Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Schema Design](#5-schema-design)
6. [Implementation Phases](#6-implementation-phases)
7. [Migration Strategy](#7-migration-strategy)
8. [API Design](#8-api-design)
9. [Testing Strategy](#9-testing-strategy)
10. [Observability & Monitoring](#10-observability--monitoring)
11. [Rollback Plan](#11-rollback-plan)
12. [Timeline & Dependencies](#12-timeline--dependencies)

---

## 1. Executive Summary

### 1.1 Vision

Transform Kaka Malem from a dual-table order system (separate `orders` and `offline_orders`) into a **Unified Commerce Platform** that provides:

- Single source of truth for all transactions
- Enterprise-grade payment processing with multi-tender support
- Comprehensive refund and exchange management
- Flexible discount and promotion engine
- Real-time inventory orchestration
- Event-driven architecture for extensibility

### 1.2 Business Drivers

| Driver           | Current Pain                        | Target State                                    |
| ---------------- | ----------------------------------- | ----------------------------------------------- |
| **Reporting**    | Separate queries for online/offline | Single unified analytics                        |
| **Refunds**      | No system, manual tracking          | Full refund workflow with inventory restoration |
| **Discounts**    | Only product-level sales            | Order/item/shipping discounts with coupons      |
| **Payments**     | Basic tracking                      | Multi-tender, split payments, reversals         |
| **Customer 360** | Fragmented history                  | Unified purchase history across channels        |

### 1.3 Success Metrics

- **Data Integrity:** 100% of historical orders migrated without loss
- **Performance:** < 200ms order creation latency (P95)
- **Reliability:** 99.9% uptime for order operations
- **Developer Experience:** Type-safe APIs with full IntelliSense

---

## 2. Current State Analysis

### 2.1 Existing Schema

```
Current Tables:
├── orders                    # Online + offline (merged previously)
├── order_items              # Line items
├── order_payments           # Payment records (basic)
├── shipments                # Delivery tracking
├── shipment_items           # Shipment line items
├── shipment_tracking_events # Tracking history
├── carts / cart_items       # Shopping carts
├── scheduled_sales          # Time-based product pricing
├── customer_groups          # Customer segmentation
├── customer_group_prices    # Segment pricing
└── inventory_movements      # Stock audit log
```

### 2.2 Current Capabilities

| Feature           | Status     | Notes                           |
| ----------------- | ---------- | ------------------------------- |
| Online orders     | ✅ Full    | GPS-based delivery zones        |
| Offline/POS sales | ✅ Full    | Receipt generation              |
| Partial payments  | ✅ Partial | Basic tracking only             |
| Multi-tender      | ❌ Missing | Single payment method per order |
| Refunds           | ❌ Missing | Status exists, no workflow      |
| Coupons/Promos    | ❌ Missing | No discount codes               |
| Order discounts   | ❌ Missing | Only `discountTotal` field      |
| Tax calculation   | ❌ Missing | `taxTotal` always 0             |
| Exchanges         | ❌ Missing | No exchange workflow            |
| Payment reversals | ❌ Missing | No reversal tracking            |

### 2.3 Technical Debt

1. **No state machine** for order status transitions
2. **No event sourcing** for audit trail
3. **Hardcoded discount logic** in checkout action
4. **No idempotency** for payment operations
5. **Missing indexes** for common query patterns

---

## 3. Target Architecture

### 3.1 Domain-Driven Design Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED COMMERCE PLATFORM                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │    ORDER     │  │   PAYMENT    │  │   PRICING    │  │  FULFILLMENT│ │
│  │   CONTEXT    │  │   CONTEXT    │  │   CONTEXT    │  │   CONTEXT  │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────┤  │
│  │ Orders       │  │ Transactions │  │ Discounts    │  │ Shipments  │  │
│  │ OrderItems   │  │ Refunds      │  │ Coupons      │  │ Tracking   │  │
│  │ OrderEvents  │  │ Settlements  │  │ Promotions   │  │ Returns    │  │
│  │ Adjustments  │  │ Ledger       │  │ Price Rules  │  │ Exchanges  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  INVENTORY   │  │   CUSTOMER   │  │  ANALYTICS   │                  │
│  │   CONTEXT    │  │   CONTEXT    │  │   CONTEXT    │                  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤                  │
│  │ Stock        │  │ Profiles     │  │ Events       │                  │
│  │ Reservations │  │ Groups       │  │ Metrics      │                  │
│  │ Movements    │  │ Loyalty      │  │ Reports      │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Event-Driven Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐
│   Action    │────▶│   Event     │────▶│        Subscribers          │
│  (Command)  │     │   Emitter   │     ├─────────────────────────────┤
└─────────────┘     └─────────────┘     │ • Inventory Service         │
                                        │ • Analytics Service         │
                                        │ • Notification Service      │
                                        │ • Webhook Dispatcher        │
                                        │ • Audit Log Writer          │
                                        └─────────────────────────────┘

Events:
├── order.created
├── order.confirmed
├── order.status_changed
├── order.item_added
├── order.item_removed
├── payment.received
├── payment.failed
├── payment.refunded
├── refund.initiated
├── refund.approved
├── refund.completed
├── discount.applied
├── inventory.reserved
├── inventory.released
├── inventory.adjusted
└── shipment.status_changed
```

### 3.3 Order State Machine

```
                              ┌──────────────┐
                              │    DRAFT     │ ◀─── POS: Items being added
                              └──────┬───────┘
                                     │ place_order
                                     ▼
                              ┌──────────────┐
              ┌───────────────│   PENDING    │───────────────┐
              │               └──────┬───────┘               │
              │ cancel               │ confirm               │ payment_timeout
              ▼                      ▼                       ▼
       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
       │  CANCELLED   │       │  CONFIRMED   │       │   EXPIRED    │
       └──────────────┘       └──────┬───────┘       └──────────────┘
                                     │ start_processing
                                     ▼
                              ┌──────────────┐
                       ┌──────│  PROCESSING  │──────┐
                       │      └──────┬───────┘      │
                       │ cancel      │ ship         │ ready_for_pickup
                       ▼             ▼              ▼
                ┌──────────┐  ┌──────────────┐  ┌──────────────┐
                │ CANCELLED│  │   SHIPPED    │  │ READY_PICKUP │
                └──────────┘  └──────┬───────┘  └──────┬───────┘
                                     │                 │
                                     │ deliver         │ pickup
                                     ▼                 ▼
                              ┌──────────────────────────┐
                              │        COMPLETED         │
                              └────────────┬─────────────┘
                                           │
                       ┌───────────────────┼───────────────────┐
                       │                   │                   │
                       ▼                   ▼                   ▼
                ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                │   REFUNDED   │   │  PARTIALLY   │   │  EXCHANGED   │
                │              │   │  REFUNDED    │   │              │
                └──────────────┘   └──────────────┘   └──────────────┘
```

### 3.4 Financial Ledger Model

Every order maintains a **financial breakdown** that is fully auditable:

```typescript
interface OrderFinancials {
  // Gross amounts
  itemsSubtotal: number; // Sum of line item prices × quantities

  // Adjustments (negative = discount, positive = fee)
  adjustments: {
    itemDiscounts: number; // Line-item level discounts
    orderDiscounts: number; // Order-level discounts (coupons)
    shippingDiscounts: number; // Free shipping promotions
    manualDiscounts: number; // Staff-applied discounts
    surcharges: number; // COD fees, handling, etc.
  };

  // Shipping & Tax
  shippingTotal: number; // Delivery fees
  taxTotal: number; // Calculated taxes

  // Gratuity
  tipAmount: number; // Optional tip (food service)

  // Calculated totals
  discountTotal: number; // Sum of all discounts
  grandTotal: number; // Final amount owed

  // Payment tracking
  amountPaid: number; // Total payments received
  amountRefunded: number; // Total refunds issued
  amountDue: number; // grandTotal - amountPaid + amountRefunded

  // Currency
  currencyCode: string; // AFN, USD, etc.
}
```

---

## 4. Technology Stack

### 4.1 Core Libraries

| Category            | Package                | Version | Purpose                        |
| ------------------- | ---------------------- | ------- | ------------------------------ |
| **State Machine**   | `xstate`               | ^5.x    | Order/payment state management |
| **Validation**      | `zod`                  | ^3.x    | Schema validation (existing)   |
| **Event Emitter**   | `eventemitter3`        | ^5.x    | In-process event bus           |
| **ID Generation**   | `@paralleldrive/cuid2` | ^2.x    | Collision-resistant IDs        |
| **Money**           | `dinero.js`            | ^2.x    | Precise currency calculations  |
| **Date/Time**       | `date-fns`             | ^4.x    | Date manipulation              |
| **Retry**           | `p-retry`              | ^6.x    | Resilient async operations     |
| **Rate Limiting**   | `@upstash/ratelimit`   | ^2.x    | API rate limiting              |
| **Background Jobs** | `trigger.dev`          | ^3.x    | Async job processing           |

### 4.2 New Dependencies to Add

```bash
# State management & events
pnpm add xstate eventemitter3

# Financial calculations
pnpm add dinero.js

# ID generation (better than nanoid for distributed systems)
pnpm add @paralleldrive/cuid2

# Resilience
pnpm add p-retry

# Background jobs (optional, for async processing)
pnpm add @trigger.dev/sdk
```

### 4.3 Emerging Patterns Adopted

| Pattern                   | Implementation              | Benefit                             |
| ------------------------- | --------------------------- | ----------------------------------- |
| **Event Sourcing (Lite)** | `order_events` table        | Full audit trail, replay capability |
| **CQRS**                  | Separate read/write models  | Optimized queries, scalability      |
| **Saga Pattern**          | XState for multi-step flows | Reliable distributed transactions   |
| **Idempotency Keys**      | Request deduplication       | Safe retries, no double charges     |
| **Optimistic Locking**    | Version columns             | Concurrent update safety            |
| **Soft Deletes**          | `deletedAt` timestamps      | Data recovery, compliance           |

---

## 5. Schema Design

### 5.1 Core Order Tables

```sql
-- ============================================================================
-- ORDERS (Enhanced)
-- ============================================================================
CREATE TABLE orders (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number VARCHAR(30) NOT NULL,      -- KM-2026-000001

  -- Channel & Type
  channel VARCHAR(20) NOT NULL DEFAULT 'online',  -- online, pos, social
  fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'shipping',  -- shipping, pickup, instant, local_delivery

  -- Customer
  customer_id UUID REFERENCES store_customers(id),
  customer_snapshot JSONB NOT NULL,        -- Immutable: {name, email, phone, company}

  -- Addresses
  shipping_address JSONB,                  -- Required for shipping orders
  billing_address JSONB,

  -- Financial Breakdown
  items_subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Adjustments
  item_discounts_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  order_discounts_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  shipping_discounts_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  manual_discounts_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  surcharges_total DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Totals
  discount_total DECIMAL(14,2) GENERATED ALWAYS AS (
    item_discounts_total + order_discounts_total +
    shipping_discounts_total + manual_discounts_total
  ) STORED,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Gratuity
  tip_amount DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Payment Tracking
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_refunded DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_due DECIMAL(14,2) GENERATED ALWAYS AS (
    grand_total + tip_amount - amount_paid + amount_refunded
  ) STORED,

  -- Currency
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AFN',

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',  -- unpaid, partial, paid, refunded, partial_refund

  -- POS Specific
  register_id VARCHAR(50),                 -- POS terminal identifier
  cashier_id UUID REFERENCES profiles(id),
  receipt_number VARCHAR(30),              -- RCP-2026-000001

  -- Timestamps
  placed_at TIMESTAMPTZ,                   -- When order was placed
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Notes
  customer_notes TEXT,
  staff_notes TEXT,
  cancellation_reason TEXT,

  -- Metadata
  source_ip INET,
  user_agent TEXT,
  idempotency_key VARCHAR(64),             -- Prevent duplicate orders
  metadata JSONB DEFAULT '{}',             -- Extensible attributes

  -- Versioning (optimistic locking)
  version INTEGER NOT NULL DEFAULT 1,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT orders_tenant_number_unique UNIQUE (tenant_id, order_number),
  CONSTRAINT orders_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT orders_grand_total_positive CHECK (grand_total >= 0),
  CONSTRAINT orders_amounts_valid CHECK (
    amount_paid >= 0 AND
    amount_refunded >= 0 AND
    amount_refunded <= amount_paid
  )
);

-- Indexes
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_channel ON orders(tenant_id, channel);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_placed_at ON orders(placed_at DESC) WHERE placed_at IS NOT NULL;

-- ============================================================================
-- ORDER ITEMS (Enhanced)
-- ============================================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Product Reference (soft reference for history)
  product_id UUID,                         -- Can be null if product deleted
  variant_id UUID,

  -- Snapshot at purchase time (immutable)
  product_snapshot JSONB NOT NULL,         -- {name, sku, image, attributes}

  -- Pricing
  unit_price DECIMAL(12,2) NOT NULL,       -- Price per unit at time of sale
  compare_at_price DECIMAL(12,2),          -- Original price (for showing savings)
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Line totals
  line_subtotal DECIMAL(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (
    (unit_price * quantity) - discount_amount + tax_amount
  ) STORED,

  -- Fulfillment tracking
  quantity_fulfilled INTEGER NOT NULL DEFAULT 0,
  quantity_refunded INTEGER NOT NULL DEFAULT 0,
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'unfulfilled',  -- unfulfilled, partial, fulfilled

  -- Tax
  tax_rate DECIMAL(5,4) DEFAULT 0,         -- e.g., 0.0500 for 5%
  tax_code VARCHAR(20),                    -- Tax category code

  -- Metadata
  notes TEXT,                              -- Line item notes
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_fulfillment_valid CHECK (
    quantity_fulfilled >= 0 AND
    quantity_fulfilled <= quantity AND
    quantity_refunded >= 0 AND
    quantity_refunded <= quantity
  )
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### 5.2 Payment & Transaction Tables

```sql
-- ============================================================================
-- ORDER TRANSACTIONS (Multi-tender payments, refunds, adjustments)
-- ============================================================================
CREATE TABLE order_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Transaction Type
  type VARCHAR(20) NOT NULL,               -- payment, refund, void, chargeback, adjustment

  -- Amount (positive for payments, negative for refunds)
  amount DECIMAL(14,2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AFN',

  -- Payment Method
  payment_method VARCHAR(30) NOT NULL,     -- cash, card, mobile_money, bank_transfer, store_credit, etc.

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, completed, failed, cancelled

  -- Gateway Details (for card/digital payments)
  gateway VARCHAR(50),                     -- stripe, paypal, local_gateway
  gateway_transaction_id VARCHAR(100),
  gateway_response JSONB,

  -- Card Details (tokenized, no sensitive data)
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),                  -- visa, mastercard, etc.

  -- Refund Specific
  parent_transaction_id UUID REFERENCES order_transactions(id),  -- Original payment being refunded
  refund_id UUID,                          -- Link to refunds table

  -- Cash Handling
  cash_received DECIMAL(14,2),             -- For calculating change
  cash_change DECIMAL(14,2),               -- Change given back

  -- Authorization
  recorded_by UUID REFERENCES profiles(id),
  authorized_by UUID REFERENCES profiles(id),  -- For approvals

  -- Idempotency
  idempotency_key VARCHAR(64),

  -- Timestamps
  processed_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT transactions_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX idx_transactions_order ON order_transactions(order_id);
CREATE INDEX idx_transactions_type ON order_transactions(type);
CREATE INDEX idx_transactions_status ON order_transactions(status);
CREATE INDEX idx_transactions_parent ON order_transactions(parent_transaction_id);
```

### 5.3 Refund Tables

```sql
-- ============================================================================
-- REFUNDS
-- ============================================================================
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Refund Number
  refund_number VARCHAR(30) NOT NULL,      -- REF-2026-000001

  -- Type
  type VARCHAR(20) NOT NULL,               -- full, partial, exchange, store_credit, appeasement

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, processing, completed, rejected

  -- Amounts
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,      -- Items being refunded
  shipping_refund DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_refund DECIMAL(14,2) NOT NULL DEFAULT 0,
  restocking_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL,

  -- Refund Method
  refund_method VARCHAR(30) NOT NULL,      -- original_payment, cash, store_credit, exchange

  -- Reason
  reason_code VARCHAR(50) NOT NULL,        -- customer_request, defective, wrong_item, not_as_described, etc.
  reason_details TEXT,

  -- Customer Communication
  customer_notes TEXT,

  -- Staff Processing
  requested_by UUID,                       -- Customer or staff who initiated
  approved_by UUID REFERENCES profiles(id),
  processed_by UUID REFERENCES profiles(id),
  rejected_by UUID REFERENCES profiles(id),

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  -- Rejection
  rejection_reason TEXT,

  -- Store Credit (if applicable)
  store_credit_id UUID,                    -- Reference to issued store credit

  -- Notes
  internal_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT refunds_tenant_number_unique UNIQUE (tenant_id, refund_number),
  CONSTRAINT refunds_total_positive CHECK (total_amount >= 0)
);

-- ============================================================================
-- REFUND ITEMS
-- ============================================================================
CREATE TABLE refund_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id),

  -- Quantities
  quantity INTEGER NOT NULL,               -- How many being refunded

  -- Amounts
  unit_refund_amount DECIMAL(12,2) NOT NULL,
  total_refund_amount DECIMAL(12,2) GENERATED ALWAYS AS (unit_refund_amount * quantity) STORED,

  -- Item Condition
  condition VARCHAR(20) NOT NULL DEFAULT 'sellable',  -- sellable, damaged, defective, missing

  -- Inventory
  restock BOOLEAN NOT NULL DEFAULT true,   -- Should item go back to inventory?
  restock_location VARCHAR(100),           -- Specific location if needed
  restocked_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,                              -- Condition notes, damage description

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT refund_items_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_refund_items_refund ON refund_items(refund_id);
CREATE INDEX idx_refund_items_order_item ON refund_items(order_item_id);
```

### 5.4 Discount & Promotion Tables

```sql
-- ============================================================================
-- COUPONS / PROMO CODES
-- ============================================================================
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Code
  code VARCHAR(50) NOT NULL,               -- SAVE20, FREESHIP, etc.
  name VARCHAR(100) NOT NULL,              -- Human readable name
  description TEXT,

  -- Type & Value
  type VARCHAR(20) NOT NULL,               -- percentage, fixed_amount, free_shipping, buy_x_get_y
  value DECIMAL(12,2) NOT NULL,            -- Discount value (% or amount)

  -- Scope
  scope VARCHAR(20) NOT NULL DEFAULT 'order',  -- order, item, shipping

  -- Limits
  minimum_order_amount DECIMAL(12,2),      -- Minimum order to apply
  maximum_discount_amount DECIMAL(12,2),   -- Cap on discount

  -- Usage Limits
  usage_limit INTEGER,                     -- Total uses allowed (null = unlimited)
  usage_limit_per_customer INTEGER,        -- Uses per customer (null = unlimited)
  usage_count INTEGER NOT NULL DEFAULT 0,  -- Current usage count

  -- Validity
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Restrictions
  eligible_products JSONB,                 -- Product IDs or null for all
  eligible_categories JSONB,               -- Category IDs or null for all
  eligible_customer_groups JSONB,          -- Customer group IDs or null for all
  excluded_products JSONB,                 -- Products that can't use this coupon
  first_order_only BOOLEAN NOT NULL DEFAULT false,

  -- Combination Rules
  combinable BOOLEAN NOT NULL DEFAULT false,  -- Can combine with other coupons?

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT coupons_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT coupons_value_positive CHECK (value > 0)
);

CREATE INDEX idx_coupons_tenant_code ON coupons(tenant_id, code);
CREATE INDEX idx_coupons_active ON coupons(tenant_id, is_active, starts_at, expires_at);

-- ============================================================================
-- COUPON USAGE (Track redemptions)
-- ============================================================================
CREATE TABLE coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES store_customers(id),

  -- Amount actually discounted
  discount_amount DECIMAL(12,2) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT coupon_usages_order_unique UNIQUE (coupon_id, order_id)
);

CREATE INDEX idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX idx_coupon_usages_customer ON coupon_usages(customer_id);

-- ============================================================================
-- ORDER DISCOUNTS (Applied discounts on an order)
-- ============================================================================
CREATE TABLE order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),  -- Null for order-level discounts

  -- Source
  source VARCHAR(30) NOT NULL,             -- coupon, automatic, manual, loyalty, employee, price_match
  coupon_id UUID REFERENCES coupons(id),   -- If from coupon

  -- Type
  type VARCHAR(20) NOT NULL,               -- percentage, fixed, buy_x_get_y
  scope VARCHAR(20) NOT NULL,              -- order, item, shipping

  -- Value
  value DECIMAL(12,2) NOT NULL,            -- Original value (% or amount)
  applied_amount DECIMAL(12,2) NOT NULL,   -- Actual discount applied

  -- Description
  title VARCHAR(100) NOT NULL,             -- "20% Off Coupon", "Manager Discount"
  description TEXT,

  -- Manual Discount Authorization
  authorized_by UUID REFERENCES profiles(id),
  authorization_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_discounts_order ON order_discounts(order_id);
CREATE INDEX idx_order_discounts_coupon ON order_discounts(coupon_id);
```

### 5.5 Order Events (Event Sourcing)

```sql
-- ============================================================================
-- ORDER EVENTS (Audit Trail / Event Sourcing)
-- ============================================================================
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event Type
  event_type VARCHAR(50) NOT NULL,         -- See event types below

  -- Actor
  actor_type VARCHAR(20) NOT NULL,         -- customer, staff, system, webhook
  actor_id UUID,                           -- User ID if applicable
  actor_name VARCHAR(100),                 -- Name snapshot

  -- Event Data
  data JSONB NOT NULL DEFAULT '{}',        -- Event-specific payload

  -- Previous State (for reversibility)
  previous_state JSONB,
  new_state JSONB,

  -- Idempotency
  idempotency_key VARCHAR(64),

  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexed fields for common queries
  event_category VARCHAR(30),              -- order, payment, fulfillment, refund

  CONSTRAINT order_events_idempotency_unique UNIQUE (order_id, idempotency_key)
);

CREATE INDEX idx_order_events_order ON order_events(order_id, occurred_at DESC);
CREATE INDEX idx_order_events_type ON order_events(event_type);
CREATE INDEX idx_order_events_tenant_occurred ON order_events(tenant_id, occurred_at DESC);

-- Event Types:
-- order.created, order.placed, order.confirmed, order.cancelled
-- order.status_changed, order.notes_updated
-- order.item_added, order.item_removed, order.item_updated
-- payment.received, payment.failed, payment.voided
-- refund.requested, refund.approved, refund.rejected, refund.completed
-- discount.applied, discount.removed
-- fulfillment.started, fulfillment.item_picked, fulfillment.shipped
-- fulfillment.delivered, fulfillment.failed
```

### 5.6 Inventory Reservations

```sql
-- ============================================================================
-- INVENTORY RESERVATIONS (Prevent overselling)
-- ============================================================================
CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Product
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,

  -- Reservation Details
  quantity INTEGER NOT NULL,

  -- Source
  source_type VARCHAR(20) NOT NULL,        -- cart, order, draft_order
  source_id UUID NOT NULL,                 -- Cart ID or Order ID

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, committed, released, expired

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,         -- Auto-release after expiry

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,

  CONSTRAINT reservations_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_reservations_product ON inventory_reservations(product_id, variant_id);
CREATE INDEX idx_reservations_source ON inventory_reservations(source_type, source_id);
CREATE INDEX idx_reservations_expires ON inventory_reservations(expires_at) WHERE status = 'active';
```

### 5.7 Store Credit

```sql
-- ============================================================================
-- STORE CREDITS
-- ============================================================================
CREATE TABLE store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,

  -- Credit Details
  code VARCHAR(20) NOT NULL,               -- SC-XXXXXX

  -- Balance
  original_amount DECIMAL(14,2) NOT NULL,
  balance DECIMAL(14,2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'AFN',

  -- Source
  source_type VARCHAR(30) NOT NULL,        -- refund, gift_card, compensation, promotion
  source_id UUID,                          -- Refund ID, etc.

  -- Validity
  expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT store_credits_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT store_credits_balance_valid CHECK (balance >= 0 AND balance <= original_amount)
);

-- ============================================================================
-- STORE CREDIT TRANSACTIONS
-- ============================================================================
CREATE TABLE store_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_credit_id UUID NOT NULL REFERENCES store_credits(id) ON DELETE CASCADE,

  -- Transaction Type
  type VARCHAR(20) NOT NULL,               -- credit, debit, refund, expiry
  amount DECIMAL(14,2) NOT NULL,           -- Positive for credit, negative for debit

  -- Balance After
  balance_after DECIMAL(14,2) NOT NULL,

  -- Reference
  order_id UUID REFERENCES orders(id),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.8 Complete Drizzle Schema Addition

The full Drizzle schema will be added in `lib/db/schema.ts` during implementation. Key additions:

```typescript
// New Enums
export const orderChannelEnum = pgEnum("order_channel", [
  "online",
  "pos",
  "phone",
  "social",
]);

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", [
  "shipping",
  "pickup",
  "instant",
  "local_delivery",
  "curbside",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partial",
  "paid",
  "refunded",
  "partial_refund",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "payment",
  "refund",
  "void",
  "chargeback",
  "adjustment",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "completed",
  "failed",
  "cancelled",
]);

export const refundTypeEnum = pgEnum("refund_type", [
  "full",
  "partial",
  "exchange",
  "store_credit",
  "appeasement",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "approved",
  "processing",
  "completed",
  "rejected",
]);

export const refundReasonEnum = pgEnum("refund_reason", [
  "customer_request",
  "defective",
  "wrong_item",
  "not_as_described",
  "arrived_late",
  "duplicate_order",
  "fraud",
  "other",
]);

export const discountSourceEnum = pgEnum("discount_source", [
  "coupon",
  "automatic",
  "manual",
  "loyalty",
  "employee",
  "price_match",
  "negotiated",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "free_shipping",
  "buy_x_get_y",
]);

export const itemConditionEnum = pgEnum("item_condition", [
  "sellable",
  "damaged",
  "defective",
  "missing",
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "active",
  "committed",
  "released",
  "expired",
]);
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Schema & Types)

**Objective:** Establish the new schema alongside existing tables

#### 1.1 Schema Migration

- [ ] Create all new tables with Drizzle schema definitions
- [ ] Generate migration files using `pnpm db:generate`
- [ ] Create indexes for query performance
- [ ] Add foreign key constraints
- [ ] Create database triggers for `updated_at` timestamps

#### 1.2 Type Definitions

```typescript
// lib/types/commerce.ts
export interface Order {
  /* ... */
}
export interface OrderItem {
  /* ... */
}
export interface OrderTransaction {
  /* ... */
}
export interface Refund {
  /* ... */
}
export interface RefundItem {
  /* ... */
}
export interface Coupon {
  /* ... */
}
export interface OrderDiscount {
  /* ... */
}
export interface OrderEvent {
  /* ... */
}
export interface InventoryReservation {
  /* ... */
}
export interface StoreCredit {
  /* ... */
}
```

#### 1.3 Zod Validation Schemas

```typescript
// lib/validations/commerce.ts
export const createOrderSchema = z.object({
  /* ... */
});
export const createTransactionSchema = z.object({
  /* ... */
});
export const initiateRefundSchema = z.object({
  /* ... */
});
export const createCouponSchema = z.object({
  /* ... */
});
export const applyDiscountSchema = z.object({
  /* ... */
});
```

---

### Phase 2: Order State Machine

**Objective:** Implement robust order lifecycle management with XState

#### 2.1 State Machine Definition

```typescript
// lib/machines/order-machine.ts
import { createMachine, assign } from "xstate";

export const orderMachine = createMachine({
  id: "order",
  initial: "draft",
  context: {
    orderId: "",
    channel: "online",
    items: [],
    payments: [],
    // ...
  },
  states: {
    draft: {
      on: {
        PLACE_ORDER: {
          target: "pending",
          guard: "hasItems",
          actions: ["calculateTotals", "reserveInventory"],
        },
      },
    },
    pending: {
      on: {
        CONFIRM: { target: "confirmed", guard: "isPaid" },
        CANCEL: { target: "cancelled", actions: ["releaseInventory"] },
        PAYMENT_TIMEOUT: { target: "expired", actions: ["releaseInventory"] },
      },
    },
    confirmed: {
      on: {
        START_PROCESSING: "processing",
      },
    },
    processing: {
      on: {
        SHIP: { target: "shipped", guard: "isShippingOrder" },
        READY_FOR_PICKUP: {
          target: "ready_for_pickup",
          guard: "isPickupOrder",
        },
        DELIVER_INSTANTLY: { target: "completed", guard: "isPOSOrder" },
      },
    },
    shipped: {
      on: { DELIVER: "completed" },
    },
    ready_for_pickup: {
      on: { PICKUP: "completed" },
    },
    completed: {
      on: {
        INITIATE_REFUND: "refund_pending",
      },
    },
    refund_pending: {
      on: {
        APPROVE_REFUND: {
          target: "refund_processing",
          actions: ["createRefundRecord"],
        },
        REJECT_REFUND: "completed",
      },
    },
    refund_processing: {
      on: {
        COMPLETE_REFUND: [
          { target: "refunded", guard: "isFullRefund" },
          { target: "partially_refunded", guard: "isPartialRefund" },
        ],
      },
    },
    cancelled: { type: "final" },
    expired: { type: "final" },
    refunded: { type: "final" },
    partially_refunded: {
      on: {
        INITIATE_REFUND: "refund_pending", // Can refund again
      },
    },
  },
});
```

#### 2.2 State Persistence

```typescript
// lib/services/order-state.ts
export class OrderStateService {
  async transition(orderId: string, event: OrderEvent): Promise<Order> {
    const order = await this.getOrder(orderId);
    const machine = orderMachine.withContext(order);
    const nextState = machine.transition(order.status, event);

    if (!nextState.changed) {
      throw new InvalidTransitionError(order.status, event);
    }

    // Execute side effects
    await this.executeSideEffects(nextState.actions, order);

    // Persist new state
    return await this.updateOrderStatus(orderId, nextState.value);
  }
}
```

---

### Phase 3: Payment Engine

**Objective:** Build multi-tender payment processing with transaction safety

#### 3.1 Transaction Service

```typescript
// lib/services/transaction-service.ts
export class TransactionService {
  /**
   * Record a payment for an order
   * Supports multi-tender (split payments across methods)
   */
  async recordPayment(input: RecordPaymentInput): Promise<OrderTransaction> {
    return await db.transaction(async (tx) => {
      // 1. Validate order state
      const order = await this.getOrderForUpdate(tx, input.orderId);
      this.validateCanAcceptPayment(order);

      // 2. Check idempotency
      if (input.idempotencyKey) {
        const existing = await this.findByIdempotencyKey(
          tx,
          input.idempotencyKey
        );
        if (existing) return existing;
      }

      // 3. Create transaction record
      const transaction = await tx
        .insert(orderTransactions)
        .values({
          orderId: input.orderId,
          tenantId: order.tenantId,
          type: "payment",
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          status: "completed",
          cashReceived: input.cashReceived,
          cashChange: input.cashReceived
            ? input.cashReceived - input.amount
            : null,
          recordedBy: input.recordedBy,
          idempotencyKey: input.idempotencyKey,
          processedAt: new Date(),
        })
        .returning();

      // 4. Update order payment totals
      const newAmountPaid = order.amountPaid + input.amount;
      const newPaymentStatus = this.calculatePaymentStatus(
        order.grandTotal,
        newAmountPaid
      );

      await tx
        .update(orders)
        .set({
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // 5. Emit event
      await this.emitEvent(tx, {
        orderId: input.orderId,
        type: "payment.received",
        data: { transactionId: transaction.id, amount: input.amount },
      });

      // 6. Auto-confirm if fully paid
      if (newPaymentStatus === "paid" && order.status === "pending") {
        await this.orderStateService.transition(input.orderId, "CONFIRM");
      }

      return transaction;
    });
  }

  /**
   * Calculate change for cash payments
   */
  calculateChange(amountDue: number, cashReceived: number): CashChangeResult {
    const change = cashReceived - amountDue;
    return {
      amountDue,
      cashReceived,
      change: change > 0 ? change : 0,
      isExact: change === 0,
      isOverpaid: change > 0,
    };
  }
}
```

#### 3.2 Money Handling with Dinero.js

```typescript
// lib/utils/money.ts
import { dinero, add, subtract, multiply, toDecimal } from "dinero.js";
import { AFN } from "@dinero.js/currencies";

export function createMoney(amount: number, currency = AFN) {
  // Convert decimal to minor units (e.g., 100.50 AFN -> 10050)
  const factor = currency.exponent;
  const minorUnits = Math.round(amount * Math.pow(10, factor));
  return dinero({ amount: minorUnits, currency });
}

export function calculateOrderTotals(
  items: OrderItem[],
  discounts: Discount[]
): OrderTotals {
  const itemsSubtotal = items.reduce((sum, item) => {
    const lineTotal = createMoney(item.unitPrice).multiply(item.quantity);
    return add(sum, lineTotal);
  }, createMoney(0));

  const totalDiscounts = discounts.reduce(
    (sum, d) => add(sum, createMoney(d.appliedAmount)),
    createMoney(0)
  );

  const grandTotal = subtract(itemsSubtotal, totalDiscounts);

  return {
    itemsSubtotal: toDecimal(itemsSubtotal),
    discountTotal: toDecimal(totalDiscounts),
    grandTotal: toDecimal(grandTotal),
  };
}
```

---

### Phase 4: Refund System

**Objective:** Implement comprehensive refund workflow with inventory restoration

#### 4.1 Refund Service

```typescript
// lib/services/refund-service.ts
export class RefundService {
  /**
   * Initiate a refund request
   */
  async initiateRefund(input: InitiateRefundInput): Promise<Refund> {
    return await db.transaction(async (tx) => {
      // 1. Validate order can be refunded
      const order = await this.getOrderWithItems(tx, input.orderId);
      this.validateCanRefund(order, input.items);

      // 2. Calculate refund amounts
      const refundCalculation = this.calculateRefundAmounts(order, input);

      // 3. Generate refund number
      const refundNumber = await this.generateRefundNumber(tx, order.tenantId);

      // 4. Create refund record
      const refund = await tx
        .insert(refunds)
        .values({
          orderId: input.orderId,
          tenantId: order.tenantId,
          refundNumber,
          type: refundCalculation.isFullRefund ? "full" : "partial",
          status: "pending",
          subtotal: refundCalculation.subtotal,
          shippingRefund: refundCalculation.shippingRefund,
          taxRefund: refundCalculation.taxRefund,
          restockingFee: input.restockingFee || 0,
          totalAmount: refundCalculation.totalAmount,
          refundMethod: input.refundMethod,
          reasonCode: input.reasonCode,
          reasonDetails: input.reasonDetails,
          requestedBy: input.requestedBy,
        })
        .returning();

      // 5. Create refund items
      await tx.insert(refundItems).values(
        input.items.map((item) => ({
          refundId: refund.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          unitRefundAmount: item.unitRefundAmount,
          condition: item.condition,
          restock: item.restock ?? true,
        }))
      );

      // 6. Emit event
      await this.emitEvent(tx, {
        orderId: input.orderId,
        type: "refund.requested",
        data: { refundId: refund.id },
      });

      return refund;
    });
  }

  /**
   * Approve and process a refund
   */
  async approveRefund(refundId: string, approvedBy: string): Promise<Refund> {
    return await db.transaction(async (tx) => {
      const refund = await this.getRefundForUpdate(tx, refundId);

      if (refund.status !== "pending") {
        throw new InvalidRefundStateError(refund.status, "approve");
      }

      // Update refund status
      await tx
        .update(refunds)
        .set({
          status: "approved",
          approvedBy,
          approvedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      return refund;
    });
  }

  /**
   * Complete the refund (process payment reversal + inventory)
   */
  async completeRefund(refundId: string, processedBy: string): Promise<Refund> {
    return await db.transaction(async (tx) => {
      const refund = await this.getRefundWithItems(tx, refundId);

      if (refund.status !== "approved") {
        throw new InvalidRefundStateError(refund.status, "complete");
      }

      // 1. Process payment reversal
      await this.processRefundPayment(tx, refund);

      // 2. Restore inventory for restockable items
      await this.restoreInventory(tx, refund);

      // 3. Update order item quantities
      await this.updateOrderItemRefundQuantities(tx, refund);

      // 4. Update order totals
      await this.updateOrderRefundTotals(tx, refund);

      // 5. Issue store credit if applicable
      if (refund.refundMethod === "store_credit") {
        await this.issueStoreCredit(tx, refund);
      }

      // 6. Update refund status
      await tx
        .update(refunds)
        .set({
          status: "completed",
          processedBy,
          processedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      // 7. Update order status
      const order = await this.getOrder(tx, refund.orderId);
      const newStatus = this.determineOrderStatusAfterRefund(order, refund);
      await this.orderStateService.transition(refund.orderId, newStatus);

      // 8. Emit event
      await this.emitEvent(tx, {
        orderId: refund.orderId,
        type: "refund.completed",
        data: { refundId },
      });

      return refund;
    });
  }

  private async restoreInventory(tx: Transaction, refund: RefundWithItems) {
    for (const item of refund.items) {
      if (!item.restock) continue;

      const orderItem = item.orderItem;

      // Create inventory movement
      await tx.insert(inventoryMovements).values({
        tenantId: refund.tenantId,
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        type: "return",
        quantity: item.quantity,
        reason: `Refund ${refund.refundNumber}`,
        orderId: refund.orderId,
      });

      // Update stock
      if (orderItem.variantId) {
        await tx
          .update(productVariants)
          .set({
            stock: sql`stock + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, orderItem.variantId));
      } else {
        await tx
          .update(products)
          .set({
            stock: sql`stock + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, orderItem.productId));
      }

      // Mark as restocked
      await tx
        .update(refundItems)
        .set({ restockedAt: new Date() })
        .where(eq(refundItems.id, item.id));
    }
  }
}
```

#### 4.2 Refund Policies Configuration

```typescript
// lib/config/refund-policies.ts
export interface RefundPolicy {
  returnWindowDays: number;
  requiresApproval: boolean;
  approvalThreshold: number; // Auto-approve under this amount
  restockingFeePercent: number;
  allowExchangeOnly: boolean;
  allowStoreCreditOnly: boolean;
  finalSaleCategories: string[];
  managerApprovalThreshold: number;
}

export const defaultRefundPolicy: RefundPolicy = {
  returnWindowDays: 14,
  requiresApproval: true,
  approvalThreshold: 500, // Auto-approve refunds under 500 AFN
  restockingFeePercent: 0,
  allowExchangeOnly: false,
  allowStoreCreditOnly: false,
  finalSaleCategories: [],
  managerApprovalThreshold: 5000, // Manager approval over 5000 AFN
};
```

---

### Phase 5: Discount & Coupon Engine

**Objective:** Build flexible promotion system with validation and stacking rules

#### 5.1 Coupon Service

```typescript
// lib/services/coupon-service.ts
export class CouponService {
  /**
   * Validate a coupon code
   */
  async validateCoupon(
    tenantId: string,
    code: string,
    context: CouponValidationContext
  ): Promise<CouponValidationResult> {
    const coupon = await this.getCouponByCode(tenantId, code);

    if (!coupon) {
      return { valid: false, error: "INVALID_CODE" };
    }

    // Check active status
    if (!coupon.isActive) {
      return { valid: false, error: "COUPON_INACTIVE" };
    }

    // Check date validity
    const now = new Date();
    if (coupon.startsAt > now) {
      return { valid: false, error: "COUPON_NOT_STARTED" };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, error: "COUPON_EXPIRED" };
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: "USAGE_LIMIT_REACHED" };
    }

    // Check per-customer limit
    if (coupon.usageLimitPerCustomer && context.customerId) {
      const customerUsage = await this.getCustomerUsageCount(
        coupon.id,
        context.customerId
      );
      if (customerUsage >= coupon.usageLimitPerCustomer) {
        return { valid: false, error: "CUSTOMER_LIMIT_REACHED" };
      }
    }

    // Check minimum order amount
    if (
      coupon.minimumOrderAmount &&
      context.orderSubtotal < coupon.minimumOrderAmount
    ) {
      return {
        valid: false,
        error: "MINIMUM_NOT_MET",
        minimumRequired: coupon.minimumOrderAmount,
      };
    }

    // Check first order only
    if (coupon.firstOrderOnly && context.customerId) {
      const hasOrders = await this.customerHasOrders(
        tenantId,
        context.customerId
      );
      if (hasOrders) {
        return { valid: false, error: "FIRST_ORDER_ONLY" };
      }
    }

    // Check eligible products
    if (coupon.eligibleProducts?.length > 0) {
      const eligibleItems = context.items.filter((item) =>
        coupon.eligibleProducts.includes(item.productId)
      );
      if (eligibleItems.length === 0) {
        return { valid: false, error: "NO_ELIGIBLE_PRODUCTS" };
      }
    }

    // Check excluded products
    if (coupon.excludedProducts?.length > 0) {
      const allExcluded = context.items.every((item) =>
        coupon.excludedProducts.includes(item.productId)
      );
      if (allExcluded) {
        return { valid: false, error: "ALL_PRODUCTS_EXCLUDED" };
      }
    }

    // Calculate discount amount
    const discountAmount = this.calculateDiscount(coupon, context);

    return {
      valid: true,
      coupon,
      discountAmount,
      appliedTo: coupon.scope,
    };
  }

  /**
   * Calculate the discount amount
   */
  private calculateDiscount(
    coupon: Coupon,
    context: CouponValidationContext
  ): number {
    let discountAmount = 0;

    switch (coupon.type) {
      case "percentage":
        discountAmount = context.orderSubtotal * (coupon.value / 100);
        break;

      case "fixed_amount":
        discountAmount = coupon.value;
        break;

      case "free_shipping":
        discountAmount = context.shippingTotal;
        break;

      case "buy_x_get_y":
        // Complex logic for buy X get Y
        discountAmount = this.calculateBuyXGetY(coupon, context);
        break;
    }

    // Apply maximum discount cap
    if (coupon.maximumDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maximumDiscountAmount);
    }

    // Cannot exceed order total
    discountAmount = Math.min(discountAmount, context.orderSubtotal);

    return discountAmount;
  }
}
```

#### 5.2 Discount Stacking Rules

```typescript
// lib/services/discount-engine.ts
export class DiscountEngine {
  /**
   * Apply all applicable discounts to an order
   * Handles stacking rules and priority
   */
  async applyDiscounts(
    order: Order,
    discountRequests: DiscountRequest[]
  ): Promise<DiscountResult> {
    const appliedDiscounts: AppliedDiscount[] = [];
    let remainingSubtotal = order.itemsSubtotal;

    // Sort by priority: automatic > loyalty > coupon > manual
    const sortedRequests = this.sortByPriority(discountRequests);

    for (const request of sortedRequests) {
      // Check if this discount can stack with already applied
      if (!this.canStack(request, appliedDiscounts)) {
        continue;
      }

      // Calculate discount on remaining amount
      const discount = await this.calculateDiscount(
        request,
        remainingSubtotal,
        order
      );

      if (discount.amount > 0) {
        appliedDiscounts.push(discount);

        // Some discounts reduce the base for subsequent discounts
        if (discount.reducesBase) {
          remainingSubtotal -= discount.amount;
        }
      }
    }

    return {
      appliedDiscounts,
      totalDiscount: appliedDiscounts.reduce((sum, d) => sum + d.amount, 0),
    };
  }

  private canStack(
    request: DiscountRequest,
    applied: AppliedDiscount[]
  ): boolean {
    // Manual discounts never stack with coupons
    if (
      request.source === "manual" &&
      applied.some((d) => d.source === "coupon")
    ) {
      return false;
    }

    // Check coupon combinability flag
    if (request.source === "coupon") {
      const couponApplied = applied.find((d) => d.source === "coupon");
      if (couponApplied && !couponApplied.coupon.combinable) {
        return false;
      }
    }

    return true;
  }
}
```

---

### Phase 6: Event System

**Objective:** Implement event-driven architecture for extensibility

#### 6.1 Event Emitter

```typescript
// lib/events/order-events.ts
import EventEmitter from "eventemitter3";

export interface OrderEventPayload {
  orderId: string;
  tenantId: string;
  type: OrderEventType;
  data: Record<string, unknown>;
  occurredAt: Date;
}

export type OrderEventType =
  | "order.created"
  | "order.placed"
  | "order.confirmed"
  | "order.cancelled"
  | "order.status_changed"
  | "payment.received"
  | "payment.failed"
  | "refund.requested"
  | "refund.approved"
  | "refund.completed"
  | "discount.applied"
  | "fulfillment.shipped"
  | "fulfillment.delivered";

class OrderEventBus extends EventEmitter<OrderEventType> {
  async emit(event: OrderEventPayload): Promise<void> {
    // 1. Persist event to database (event sourcing)
    await this.persistEvent(event);

    // 2. Emit to in-process subscribers
    super.emit(event.type, event);

    // 3. Optionally queue for async processing
    if (this.asyncEventTypes.includes(event.type)) {
      await this.queueForAsyncProcessing(event);
    }
  }

  private async persistEvent(event: OrderEventPayload): Promise<void> {
    await db.insert(orderEvents).values({
      orderId: event.orderId,
      tenantId: event.tenantId,
      eventType: event.type,
      actorType: "system",
      data: event.data,
      occurredAt: event.occurredAt,
    });
  }
}

export const orderEvents = new OrderEventBus();
```

#### 6.2 Event Subscribers

```typescript
// lib/events/subscribers/index.ts

// Inventory subscriber
orderEvents.on("order.placed", async (event) => {
  await inventoryService.commitReservations(event.orderId);
});

orderEvents.on("order.cancelled", async (event) => {
  await inventoryService.releaseReservations(event.orderId);
});

orderEvents.on("refund.completed", async (event) => {
  await inventoryService.processRefundRestock(event.data.refundId);
});

// Analytics subscriber
orderEvents.on("order.placed", async (event) => {
  await analyticsService.recordOrderPlaced(event);
});

orderEvents.on("payment.received", async (event) => {
  await analyticsService.recordPayment(event);
});

// Notification subscriber
orderEvents.on("order.confirmed", async (event) => {
  await notificationService.sendOrderConfirmation(event.orderId);
});

orderEvents.on("fulfillment.shipped", async (event) => {
  await notificationService.sendShippingNotification(event.orderId);
});

orderEvents.on("refund.completed", async (event) => {
  await notificationService.sendRefundConfirmation(event.data.refundId);
});
```

---

### Phase 7: API & Actions Layer

**Objective:** Implement server actions with proper validation and error handling

#### 7.1 Order Actions

```typescript
// lib/actions/orders/create-order.ts
"use server";

import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";

const createOrderSchema = z.object({
  tenantId: z.string().uuid(),
  channel: z.enum(["online", "pos", "phone"]),
  customerId: z.string().uuid().optional(),
  customerSnapshot: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  fulfillmentType: z.enum(["shipping", "pickup", "instant", "local_delivery"]),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function createOrderAction(
  input: z.infer<typeof createOrderSchema>
) {
  try {
    // 1. Validate input
    const validated = createOrderSchema.parse(input);

    // 2. Check idempotency
    if (validated.idempotencyKey) {
      const existing = await orderService.findByIdempotencyKey(
        validated.tenantId,
        validated.idempotencyKey
      );
      if (existing) {
        return { success: true, order: existing };
      }
    }

    // 3. Create order
    const order = await orderService.createOrder({
      ...validated,
      idempotencyKey: validated.idempotencyKey || createId(),
    });

    // 4. Revalidate cache
    revalidatePath(`/dashboard/${validated.tenantId}/orders`);

    return { success: true, order };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        details: error.errors,
      };
    }
    if (error instanceof InsufficientStockError) {
      return {
        success: false,
        error: "INSUFFICIENT_STOCK",
        items: error.items,
      };
    }
    throw error;
  }
}
```

#### 7.2 Refund Actions

```typescript
// lib/actions/refunds/initiate-refund.ts
"use server";

export async function initiateRefundAction(input: InitiateRefundInput) {
  // Authorization check
  const context = await getUserStoreContext(input.tenantId);
  if (!context || !hasMinimumRole(context, "staff")) {
    throw new UnauthorizedError("Insufficient permissions to process refunds");
  }

  // Validate refund policy
  const order = await orderService.getOrder(input.orderId);
  const policy = await getRefundPolicy(input.tenantId);

  if (!isWithinReturnWindow(order, policy)) {
    return { success: false, error: "RETURN_WINDOW_EXPIRED" };
  }

  // Create refund
  const refund = await refundService.initiateRefund({
    ...input,
    requestedBy: context.userId,
  });

  // Check auto-approval
  if (refund.totalAmount <= policy.approvalThreshold) {
    await refundService.approveRefund(refund.id, "system");
  }

  revalidatePath(`/dashboard/${input.tenantId}/orders/${input.orderId}`);

  return { success: true, refund };
}
```

---

### Phase 8: UI Components

**Objective:** Build reusable UI components for the unified commerce system

#### 8.1 Component Structure

```
components/
├── commerce/
│   ├── orders/
│   │   ├── order-list.tsx
│   │   ├── order-detail.tsx
│   │   ├── order-timeline.tsx
│   │   ├── order-status-badge.tsx
│   │   └── order-actions-menu.tsx
│   ├── payments/
│   │   ├── payment-form.tsx
│   │   ├── payment-list.tsx
│   │   ├── split-payment.tsx
│   │   └── cash-calculator.tsx
│   ├── refunds/
│   │   ├── refund-wizard.tsx
│   │   ├── refund-items-selector.tsx
│   │   ├── refund-summary.tsx
│   │   └── refund-history.tsx
│   ├── discounts/
│   │   ├── coupon-input.tsx
│   │   ├── discount-list.tsx
│   │   ├── manual-discount-form.tsx
│   │   └── discount-badge.tsx
│   └── pos/
│       ├── pos-terminal.tsx
│       ├── product-grid.tsx
│       ├── cart-panel.tsx
│       └── checkout-panel.tsx
```

#### 8.2 Key UI Components

```typescript
// components/commerce/refunds/refund-wizard.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function RefundWizard({ order, onComplete }: RefundWizardProps) {
  const [step, setStep] = useState<'items' | 'reason' | 'method' | 'confirm'>('items');

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <RefundWizardProgress currentStep={step} />

      {step === 'items' && (
        <RefundItemsSelector
          orderItems={order.items}
          onNext={(items) => {
            setSelectedItems(items);
            setStep('reason');
          }}
        />
      )}

      {step === 'reason' && (
        <RefundReasonForm
          onNext={(reason) => {
            setReason(reason);
            setStep('method');
          }}
          onBack={() => setStep('items')}
        />
      )}

      {step === 'method' && (
        <RefundMethodSelector
          totalAmount={calculateRefundTotal()}
          onNext={(method) => {
            setMethod(method);
            setStep('confirm');
          }}
          onBack={() => setStep('reason')}
        />
      )}

      {step === 'confirm' && (
        <RefundConfirmation
          summary={{
            items: selectedItems,
            reason,
            method,
            totalAmount: calculateRefundTotal(),
          }}
          onConfirm={handleSubmitRefund}
          onBack={() => setStep('method')}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
```

---

## 7. Migration Strategy

### 7.1 Data Migration Approach

**Strategy: Parallel Write, Gradual Read Migration**

```
Phase 1: Schema deployed, new tables empty
Phase 2: Dual-write (write to both old and new)
Phase 3: Backfill historical data
Phase 4: Read from new, write to both
Phase 5: Read and write from new only
Phase 6: Archive and drop old tables
```

### 7.2 Migration Script

```typescript
// scripts/migrate-orders.ts
import { db } from "@/lib/db";
import {
  orders as oldOrders,
  orderItems as oldOrderItems,
} from "@/lib/db/schema";

async function migrateOrders() {
  console.log("Starting order migration...");

  const BATCH_SIZE = 100;
  let offset = 0;
  let migratedCount = 0;

  while (true) {
    // Fetch batch of old orders
    const batch = await db.query.orders.findMany({
      with: { items: true, payments: true },
      limit: BATCH_SIZE,
      offset,
      orderBy: asc(oldOrders.createdAt),
    });

    if (batch.length === 0) break;

    // Transform and insert into new schema
    await db.transaction(async (tx) => {
      for (const oldOrder of batch) {
        // Transform to new schema
        const newOrder = transformOrder(oldOrder);
        const newItems = oldOrder.items.map(transformOrderItem);
        const newPayments = oldOrder.payments.map(transformPayment);

        // Insert into new tables
        await tx.insert(newOrders).values(newOrder);
        await tx.insert(newOrderItems).values(newItems);
        await tx.insert(newOrderTransactions).values(newPayments);

        // Create initial event
        await tx.insert(orderEvents).values({
          orderId: newOrder.id,
          tenantId: newOrder.tenantId,
          eventType: "order.migrated",
          actorType: "system",
          data: { migratedFrom: "legacy_orders", originalId: oldOrder.id },
          occurredAt: oldOrder.createdAt,
        });
      }
    });

    migratedCount += batch.length;
    offset += BATCH_SIZE;
    console.log(`Migrated ${migratedCount} orders...`);
  }

  console.log(`Migration complete. Total orders migrated: ${migratedCount}`);
}

function transformOrder(old: LegacyOrder): NewOrder {
  return {
    id: old.id, // Preserve IDs for foreign key integrity
    tenantId: old.tenantId,
    orderNumber: old.orderNumber,
    channel: old.salesChannel || "online",
    fulfillmentType: old.salesChannel === "offline" ? "instant" : "shipping",
    customerId: old.storeCustomerId,
    customerSnapshot: old.customerSnapshot,
    shippingAddress: old.shippingAddress,
    billingAddress: old.billingAddress,

    // Financial mapping
    itemsSubtotal: old.subtotal,
    shippingSubtotal: old.shippingTotal,
    taxSubtotal: old.taxTotal,
    itemDiscountsTotal: 0,
    orderDiscountsTotal: old.discountTotal,
    shippingDiscountsTotal: 0,
    manualDiscountsTotal: 0,
    surchargesTotal: 0,
    grandTotal: old.total,
    tipAmount: 0,

    // Payment tracking
    amountPaid: old.isPaid ? old.total : 0,
    amountRefunded: 0,
    currencyCode: "AFN",

    // Status mapping
    status: old.status,
    paymentStatus: old.isPaid ? "paid" : "unpaid",

    // POS fields
    registerId: null,
    cashierId: null,
    receiptNumber: old.receiptNumber,

    // Timestamps
    placedAt: old.createdAt,
    confirmedAt: old.status !== "pending" ? old.updatedAt : null,
    completedAt: old.status === "delivered" ? old.updatedAt : null,
    cancelledAt: old.status === "cancelled" ? old.updatedAt : null,

    // Notes
    customerNotes: old.customerNotes,
    staffNotes: old.staffNotes,

    // Metadata
    metadata: {},
    version: 1,

    createdAt: old.createdAt,
    updatedAt: old.updatedAt,
  };
}
```

### 7.3 Rollback Strategy

```typescript
// scripts/rollback-migration.ts
async function rollbackMigration() {
  console.log("Rolling back to legacy schema...");

  // 1. Update feature flag
  await setFeatureFlag("use_unified_commerce", false);

  // 2. Stop dual-write
  await setFeatureFlag("dual_write_orders", false);

  // 3. Application will now use legacy tables
  console.log("Rollback complete. Using legacy order tables.");
}
```

---

## 8. API Design

### 8.1 Server Action Signatures

```typescript
// Order Actions
createOrderAction(input: CreateOrderInput): Promise<ActionResult<Order>>
updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<ActionResult<Order>>
cancelOrderAction(orderId: string, reason?: string): Promise<ActionResult<Order>>

// Payment Actions
recordPaymentAction(input: RecordPaymentInput): Promise<ActionResult<OrderTransaction>>
voidPaymentAction(transactionId: string): Promise<ActionResult<OrderTransaction>>

// Refund Actions
initiateRefundAction(input: InitiateRefundInput): Promise<ActionResult<Refund>>
approveRefundAction(refundId: string): Promise<ActionResult<Refund>>
rejectRefundAction(refundId: string, reason: string): Promise<ActionResult<Refund>>
completeRefundAction(refundId: string): Promise<ActionResult<Refund>>

// Coupon Actions
validateCouponAction(tenantId: string, code: string, context: CartContext): Promise<ActionResult<CouponValidation>>
createCouponAction(input: CreateCouponInput): Promise<ActionResult<Coupon>>
updateCouponAction(couponId: string, input: UpdateCouponInput): Promise<ActionResult<Coupon>>
deactivateCouponAction(couponId: string): Promise<ActionResult<Coupon>>

// Discount Actions
applyManualDiscountAction(input: ApplyDiscountInput): Promise<ActionResult<OrderDiscount>>
removeDiscountAction(discountId: string): Promise<ActionResult<void>>
```

### 8.2 Query Functions

```typescript
// Order Queries
getOrder(orderId: string): Promise<OrderWithDetails | null>
getOrders(tenantId: string, filters: OrderFilters): Promise<PaginatedResult<Order>>
getOrderTimeline(orderId: string): Promise<OrderEvent[]>
getOrderFinancials(orderId: string): Promise<OrderFinancials>

// Payment Queries
getOrderTransactions(orderId: string): Promise<OrderTransaction[]>
getTransactionSummary(orderId: string): Promise<TransactionSummary>

// Refund Queries
getRefund(refundId: string): Promise<RefundWithItems | null>
getOrderRefunds(orderId: string): Promise<Refund[]>
getRefundableItems(orderId: string): Promise<RefundableItem[]>

// Coupon Queries
getCoupon(couponId: string): Promise<Coupon | null>
getCoupons(tenantId: string, filters: CouponFilters): Promise<PaginatedResult<Coupon>>
getCouponUsageStats(couponId: string): Promise<CouponUsageStats>

// Analytics Queries
getOrderStats(tenantId: string, dateRange: DateRange): Promise<OrderStats>
getRefundStats(tenantId: string, dateRange: DateRange): Promise<RefundStats>
getDiscountStats(tenantId: string, dateRange: DateRange): Promise<DiscountStats>
```

---

## 9. Testing Strategy

### 9.1 Test Categories

| Category          | Tools            | Coverage Target         |
| ----------------- | ---------------- | ----------------------- |
| Unit Tests        | Vitest           | 80% for services        |
| Integration Tests | Vitest + Test DB | 70% for actions         |
| E2E Tests         | Playwright       | Critical paths          |
| Load Tests        | k6               | Order creation endpoint |

### 9.2 Test Scenarios

```typescript
// __tests__/services/order-service.test.ts
describe("OrderService", () => {
  describe("createOrder", () => {
    it("should create order with correct totals");
    it("should reserve inventory on creation");
    it("should reject if insufficient stock");
    it("should handle idempotency correctly");
    it("should emit order.created event");
  });

  describe("state transitions", () => {
    it("should transition from pending to confirmed on payment");
    it("should reject invalid transitions");
    it("should release inventory on cancellation");
  });
});

describe("RefundService", () => {
  describe("initiateRefund", () => {
    it("should create refund with correct calculations");
    it("should validate return window");
    it("should check item quantities");
    it("should apply restocking fee");
  });

  describe("completeRefund", () => {
    it("should restore inventory when restock=true");
    it("should update order totals");
    it("should issue store credit when method=store_credit");
    it("should update order status correctly");
  });
});

describe("CouponService", () => {
  describe("validateCoupon", () => {
    it("should validate active coupons");
    it("should reject expired coupons");
    it("should enforce usage limits");
    it("should check minimum order amount");
    it("should validate eligible products");
  });
});
```

### 9.3 Testing Setup

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "tests"],
    },
  },
});
```

---

## 10. Observability & Monitoring

### 10.1 Metrics to Track

| Metric                      | Type      | Description                     |
| --------------------------- | --------- | ------------------------------- |
| `orders_created_total`      | Counter   | Total orders created by channel |
| `order_value_total`         | Counter   | Total order value (AFN)         |
| `payment_latency_seconds`   | Histogram | Payment processing time         |
| `refund_rate`               | Gauge     | Refund rate (%)                 |
| `coupon_redemption_rate`    | Gauge     | Coupon usage rate               |
| `inventory_stockout_events` | Counter   | Out of stock during checkout    |

### 10.2 Logging Strategy

```typescript
// lib/utils/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: "kakamalem",
    }),
  },
});

// Usage in services
logger.info({ orderId, tenantId, amount }, "Payment received");
logger.warn({ orderId, error: error.message }, "Payment failed");
logger.error({ orderId, error }, "Unexpected error during checkout");
```

### 10.3 Health Checks

```typescript
// app/api/health/commerce/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    inventoryService: await checkInventoryService(),
    paymentGateway: await checkPaymentGateway(),
  };

  const healthy = Object.values(checks).every((c) => c.status === "ok");

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
```

---

## 11. Rollback Plan

### 11.1 Feature Flags

```typescript
// lib/config/feature-flags.ts
export const featureFlags = {
  useUnifiedCommerce: process.env.FF_UNIFIED_COMMERCE === "true",
  dualWriteOrders: process.env.FF_DUAL_WRITE === "true",
  enableRefunds: process.env.FF_REFUNDS === "true",
  enableCoupons: process.env.FF_COUPONS === "true",
};
```

### 11.2 Rollback Triggers

| Trigger            | Threshold      | Action                   |
| ------------------ | -------------- | ------------------------ |
| Error rate         | > 5% of orders | Disable unified commerce |
| P99 latency        | > 2s           | Scale investigation      |
| Payment failures   | > 1%           | Alert + investigate      |
| Data inconsistency | Any            | Immediate rollback       |

### 11.3 Rollback Procedure

1. **Disable feature flag** → Immediate traffic switch
2. **Verify legacy system** → Check order creation works
3. **Investigate** → Root cause analysis
4. **Fix and redeploy** → Address the issue
5. **Re-enable gradually** → Canary deployment

---

## 12. Timeline & Dependencies

### 12.1 Phase Dependencies

```
┌──────────────────────────────────────────────────────────────────┐
│                     IMPLEMENTATION PHASES                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Foundation ──────┬─────────────────────────────────▶  │
│  (Schema, Types)           │                                     │
│                            │                                     │
│                            ▼                                     │
│  Phase 2: State Machine ───┬─────────────────────────────────▶  │
│  (XState, Transitions)     │                                     │
│                            │                                     │
│         ┌──────────────────┴──────────────────┐                 │
│         │                                      │                 │
│         ▼                                      ▼                 │
│  Phase 3: Payments         Phase 4: Refunds                     │
│  (Multi-tender)            (Full workflow)                      │
│         │                                      │                 │
│         └──────────────────┬──────────────────┘                 │
│                            │                                     │
│                            ▼                                     │
│  Phase 5: Discounts ───────┬─────────────────────────────────▶  │
│  (Coupons, Manual)         │                                     │
│                            │                                     │
│                            ▼                                     │
│  Phase 6: Events ──────────┬─────────────────────────────────▶  │
│  (Event sourcing)          │                                     │
│                            │                                     │
│         ┌──────────────────┴──────────────────┐                 │
│         │                                      │                 │
│         ▼                                      ▼                 │
│  Phase 7: API Layer        Phase 8: UI                          │
│  (Server actions)          (Components)                         │
│                                                                  │
│                            │                                     │
│                            ▼                                     │
│  Phase 9: Migration ───────────────────────────────────────────▶│
│  (Data migration)                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 12.2 Deliverables Per Phase

| Phase                | Key Deliverables                                        |
| -------------------- | ------------------------------------------------------- |
| **1. Foundation**    | Schema migration, TypeScript types, Zod schemas         |
| **2. State Machine** | XState machine, transition validators, guards           |
| **3. Payments**      | TransactionService, multi-tender support, cash handling |
| **4. Refunds**       | RefundService, inventory restoration, store credit      |
| **5. Discounts**     | CouponService, DiscountEngine, stacking rules           |
| **6. Events**        | Event bus, subscribers, audit trail                     |
| **7. API**           | Server actions, query functions, error handling         |
| **8. UI**            | Order detail, refund wizard, payment forms, POS updates |
| **9. Migration**     | Migration scripts, data validation, rollback plan       |

### 12.3 Risk Mitigation

| Risk                       | Mitigation                                              |
| -------------------------- | ------------------------------------------------------- |
| Data loss during migration | Full backup before migration, validation scripts        |
| Performance regression     | Load testing, gradual rollout, monitoring               |
| Business disruption        | Feature flags, rollback procedure, off-hours deployment |
| Integration failures       | Comprehensive integration tests, staging environment    |

---

## Appendix A: Glossary

| Term                   | Definition                                                  |
| ---------------------- | ----------------------------------------------------------- |
| **Multi-tender**       | Accepting multiple payment methods for a single transaction |
| **Idempotency**        | Ensuring operations produce the same result when repeated   |
| **Event Sourcing**     | Storing state changes as a sequence of events               |
| **CQRS**               | Command Query Responsibility Segregation                    |
| **Optimistic Locking** | Detecting concurrent modifications using version numbers    |
| **Soft Delete**        | Marking records as deleted without physical removal         |
| **Appeasement**        | Goodwill credit issued without requiring a return           |

---

## Appendix B: References

1. [XState Documentation](https://xstate.js.org/docs/)
2. [Dinero.js Documentation](https://v2.dinerojs.com/)
3. [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
4. [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
5. [Drizzle ORM Documentation](https://orm.drizzle.team/)

---

## Changelog

| Version | Date     | Changes         |
| ------- | -------- | --------------- |
| 1.0.0   | Jan 2026 | Initial roadmap |
