# Notification System Roadmap

## Executive Summary

This document outlines the enterprise-grade notification system for Kaka Malem using Novu. The system supports multi-channel notifications (in-app, push, email) with granular user preferences.

**Status: IN PROGRESS** - Novu integration started, basic infrastructure in place.

---

## Current State Analysis

### What We Have ✅

- Novu SDK integrated (`@novu/api`, `@novu/react`)
- Basic notification infrastructure in `lib/notifications/`
- Push subscriptions via Novu
- Notifications triggered on order creation

### In Progress

- [ ] In-app notification center component
- [ ] User notification preferences UI
- [ ] Email notification templates
- [ ] Customer notifications (order status updates)

### Future Enhancements

- Notification history/feed
- Digest/batching for high-volume stores
- SMS integration

---

## Industry Standards & Best Practices

### How Enterprise Companies Handle Notifications

Based on research from [System Design Handbook](https://www.systemdesignhandbook.com/guides/design-a-notification-system/), [MagicBell](https://www.magicbell.com/blog/notification-system-design), and [Knock](https://knock.app/blog/the-top-notification-infrastructure-platforms-for-developers):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE NOTIFICATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Event Source ──► Message Queue ──► Workflow Engine ──► Channel Router     │
│        │                                    │                    │          │
│   (Order placed)                    (Check preferences)    ┌────┴────┐      │
│                                     (Apply rules)          │         │      │
│                                     (Digest/batch)    In-App    Push       │
│                                                            │         │      │
│                                                       Email    SMS         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Never inline notifications** - Always use a message queue
2. **Dual notification rule** - Every email should also create an in-app notification
3. **User preferences are sacred** - Respect opt-outs, quiet hours, channel preferences
4. **Idempotency** - Prevent duplicate notifications
5. **Graceful degradation** - If push fails, fall back to in-app

---

## Technology Recommendation: Novu

After evaluating [Novu](https://github.com/novuhq/novu), [Knock](https://knock.app), [OneSignal](https://onesignal.com), and custom solutions:

### Why Novu?

| Feature                    | Novu               | Knock   | OneSignal    | Custom (web-push) |
| -------------------------- | ------------------ | ------- | ------------ | ----------------- |
| Open Source                | ✅ MIT             | ❌      | ❌           | N/A               |
| Self-Hosted                | ✅ Free            | ❌      | ❌           | ✅                |
| In-App Notification Center | ✅ React component | ✅      | ❌           | ❌ Build yourself |
| Multi-Channel              | ✅ All             | ✅ All  | Push-focused | Push only         |
| Workflow Engine            | ✅ Visual + Code   | ✅      | Basic        | ❌                |
| User Preferences UI        | ✅ Built-in        | ✅      | Basic        | ❌ Build yourself |
| Digest/Batching            | ✅                 | ✅      | ❌           | ❌                |
| Cost                       | Free (self-host)   | $250/mo | $19/mo       | Free              |
| Multi-tenant Support       | ✅                 | ✅      | Limited      | Manual            |

### Novu Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           NOVU ARCHITECTURE                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Kaka Malem App                         Novu (Self-Hosted)              │
│   ┌─────────────┐                        ┌─────────────────────┐         │
│   │ Order Event │────trigger────────────►│  Workflow Engine    │         │
│   └─────────────┘                        │  ┌───────────────┐  │         │
│                                          │  │ Check prefs   │  │         │
│   ┌─────────────┐                        │  │ Apply digest  │  │         │
│   │ React App   │◄───WebSocket──────────│  │ Route channel │  │         │
│   │ <Inbox />   │                        │  └───────────────┘  │         │
│   └─────────────┘                        │         │           │         │
│                                          │    ┌────┴────┐      │         │
│   ┌─────────────┐                        │    ▼         ▼      │         │
│   │ Service     │◄───Push───────────────│  In-App    Push     │         │
│   │ Worker      │                        │    │         │      │         │
│   └─────────────┘                        │  Email    SMS      │         │
│                                          └─────────────────────┘         │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### NPM Packages

```bash
# Server-side
pnpm add @novu/api           # New unified API (replaces @novu/node)

# Client-side
pnpm add @novu/react         # In-app notification center component
pnpm add @novu/js            # JavaScript SDK for subscriptions
```

---

## Notification Categories

### For Store Owners/Staff (B2B)

| Event               | In-App | Push     | Email        | Priority |
| ------------------- | ------ | -------- | ------------ | -------- |
| New order placed    | ✅     | ✅       | Optional     | High     |
| Order cancelled     | ✅     | ✅       | ✅           | High     |
| Low stock alert     | ✅     | ✅       | Daily digest | Medium   |
| Out of stock        | ✅     | ✅       | ✅           | High     |
| New review received | ✅     | Optional | Daily digest | Low      |
| Payment received    | ✅     | ✅       | Optional     | High     |
| Refund processed    | ✅     | ✅       | ✅           | High     |
| Daily sales summary | ✅     | ❌       | ✅           | Low      |

### For Customers (B2C)

| Event                  | In-App | Push | Email    | SMS      |
| ---------------------- | ------ | ---- | -------- | -------- |
| Order confirmed        | ✅     | ✅   | ✅       | Optional |
| Order shipped          | ✅     | ✅   | ✅       | ✅       |
| Out for delivery       | ✅     | ✅   | ❌       | ✅       |
| Order delivered        | ✅     | ✅   | ✅       | ❌       |
| Order cancelled        | ✅     | ✅   | ✅       | ✅       |
| Back in stock          | ✅     | ✅   | ✅       | ❌       |
| Price drop on wishlist | ✅     | ✅   | Optional | ❌       |
| Review reminder        | ✅     | ❌   | ✅       | ❌       |

---

## Database Schema Changes

### New Tables

```sql
-- User notification preferences (global defaults)
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Global preferences
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,          -- e.g., '22:00'
  quiet_hours_end TIME,            -- e.g., '08:00'
  timezone TEXT DEFAULT 'Asia/Kabul',

  -- Channel preferences (defaults)
  in_app_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Store-specific notification preferences (overrides per store)
CREATE TABLE store_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Override global settings for this store
  notifications_enabled BOOLEAN DEFAULT true,  -- Master switch for this store

  -- Event-specific preferences (JSON for flexibility)
  -- Example: { "new_order": { "push": true, "email": false }, "low_stock": { "push": false } }
  event_preferences JSONB DEFAULT '{}',

  -- Digest preferences for this store
  digest_enabled BOOLEAN DEFAULT false,
  digest_frequency TEXT DEFAULT 'daily',  -- 'hourly', 'daily', 'weekly'
  digest_time TIME DEFAULT '09:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, tenant_id)
);

-- Customer notification preferences (per store)
CREATE TABLE customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Channel preferences
  order_updates_push BOOLEAN DEFAULT true,
  order_updates_email BOOLEAN DEFAULT true,
  order_updates_sms BOOLEAN DEFAULT false,

  promotional_push BOOLEAN DEFAULT false,
  promotional_email BOOLEAN DEFAULT false,

  back_in_stock BOOLEAN DEFAULT true,
  price_drops BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, tenant_id)
);

-- Notification history/feed (for in-app display)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL for platform notifications

  -- Content
  type TEXT NOT NULL,              -- 'new_order', 'order_shipped', 'low_stock', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',         -- Additional data (order_id, product_id, etc.)

  -- Actions
  action_url TEXT,                 -- Where to navigate on click
  action_label TEXT,               -- Button text if applicable

  -- State
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Delivery tracking
  channels_sent JSONB DEFAULT '[]',  -- ['in_app', 'push', 'email']

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  INDEX idx_notifications_user_unread (user_id, read_at) WHERE read_at IS NULL
);

-- Push subscriptions (enhanced from current)
-- Keep existing push_subscriptions table but add:
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;  -- Optional: for store-specific subscriptions
```

---

## Implementation Phases

### Phase 1: Foundation (COMPLETED) ✅

**Goal**: Set up Novu infrastructure and migrate existing push notifications

- [x] Integrate Novu SDK (`@novu/api`, `@novu/react`)
- [x] Create notification infrastructure in `lib/notifications/`
- [x] Create basic notification workflows:
  - `new-order-owner` - Notify store owner of new order
- [x] Integrate Novu in server actions for order notifications

### Phase 2: In-App Notification Center (Week 2-3)

**Goal**: Add persistent notification feed UI

- [ ] Install `@novu/react` components
- [ ] Add notification bell icon to:
  - Dashboard header (for store owners/staff)
  - Storefront header (for customers)
- [ ] Implement notification feed with:
  - Unread count badge
  - Mark as read/unread
  - Click to navigate
  - Load more pagination
- [ ] Real-time updates via WebSocket

### Phase 3: User Preferences UI (Week 3-4)

**Goal**: Give users control over their notifications

- [ ] Create preferences page in account settings:
  - Global defaults (quiet hours, channels)
  - Per-store overrides
- [ ] Create preferences page for customers:
  - Order updates preferences
  - Marketing opt-in/out
- [ ] Implement preference enforcement in workflows

### Phase 4: Store Owner Notifications (Week 4-5)

**Goal**: Complete B2B notification coverage

- [ ] Implement workflows:
  - `order-cancelled`
  - `low-stock-alert`
  - `out-of-stock`
  - `new-review`
  - `payment-received`
  - `refund-processed`
- [ ] Add digest/batching for high-volume stores
- [ ] Daily sales summary email

### Phase 5: Customer Notifications (Week 5-6)

**Goal**: Complete B2C notification coverage

- [ ] Implement workflows:
  - `order-confirmed`
  - `order-shipped`
  - `out-for-delivery`
  - `order-delivered`
  - `back-in-stock`
  - `price-drop-wishlist`
  - `review-reminder` (7 days after delivery)
- [ ] SMS integration (optional, for delivery updates)

### Phase 6: Analytics & Optimization (Week 6+)

**Goal**: Measure and improve notification effectiveness

- [ ] Track delivery rates by channel
- [ ] Track open/click rates
- [ ] A/B test notification content
- [ ] Implement smart delivery timing

---

## UI/UX Design

### Notification Bell (Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard Header                                    🔔 (3)  👤  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ Notifications                    ✓ All │ ← Dropdown on click │
│  ├──────────────────────────────────────┤                       │
│  │ 🆕 New order #1234              2m    │ ← Unread (bold)      │
│  │    Ahmad ordered 3 items              │                       │
│  ├──────────────────────────────────────┤                       │
│  │ 🆕 New order #1233              15m   │                       │
│  │    Fatima ordered 1 item              │                       │
│  ├──────────────────────────────────────┤                       │
│  │    Low stock alert              1h    │ ← Read (normal)      │
│  │    T-Shirt Blue (5 remaining)         │                       │
│  ├──────────────────────────────────────┤                       │
│  │           View all notifications      │                       │
│  └──────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Account Settings - Notifications

```
┌─────────────────────────────────────────────────────────────────┐
│  Account Settings > Notifications                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Global Settings                                                │
│  ──────────────────────────────────────────────────────         │
│  Quiet Hours          [OFF]                                     │
│  Don't disturb me between 10 PM - 8 AM                          │
│                                                                  │
│  Default Channels                                               │
│  ☑ In-App Notifications                                         │
│  ☑ Browser Push Notifications                                   │
│  ☐ Email Notifications                                          │
│                                                                  │
│  ──────────────────────────────────────────────────────         │
│                                                                  │
│  Per-Store Settings                                             │
│  ──────────────────────────────────────────────────────         │
│                                                                  │
│  📦 My Awesome Store                              [Enabled ▼]   │
│  ├─ New Orders         Push ☑  Email ☐                         │
│  ├─ Order Cancellations Push ☑  Email ☑                         │
│  ├─ Low Stock Alerts   Push ☐  Email ☑ (Daily digest)          │
│  └─ New Reviews        Push ☐  Email ☐                          │
│                                                                  │
│  📦 Second Store                                  [Disabled ▼]  │
│  (Notifications muted for this store)                           │
│                                                                  │
│                                         [Save Preferences]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Novu Self-Hosted Setup

### Docker Compose Addition

```yaml
# Add to docker-compose.yml or create docker-compose.novu.yml

services:
  novu-api:
    image: ghcr.io/novuhq/novu/api:latest
    depends_on:
      - novu-mongodb
      - novu-redis
    environment:
      - NODE_ENV=production
      - MONGO_URL=mongodb://novu-mongodb:27017/novu
      - REDIS_URL=redis://novu-redis:6379
      - JWT_SECRET=${NOVU_JWT_SECRET}
      - STORE_ENCRYPTION_KEY=${NOVU_ENCRYPTION_KEY}
    ports:
      - "3002:3000"

  novu-worker:
    image: ghcr.io/novuhq/novu/worker:latest
    depends_on:
      - novu-mongodb
      - novu-redis
    environment:
      - NODE_ENV=production
      - MONGO_URL=mongodb://novu-mongodb:27017/novu
      - REDIS_URL=redis://novu-redis:6379

  novu-ws:
    image: ghcr.io/novuhq/novu/ws:latest
    depends_on:
      - novu-mongodb
      - novu-redis
    environment:
      - NODE_ENV=production
      - MONGO_URL=mongodb://novu-mongodb:27017/novu
      - REDIS_URL=redis://novu-redis:6379
    ports:
      - "3003:3000"

  novu-mongodb:
    image: mongo:latest
    volumes:
      - novu-mongodb-data:/data/db

  novu-redis:
    image: redis:alpine
    volumes:
      - novu-redis-data:/data

volumes:
  novu-mongodb-data:
  novu-redis-data:
```

### Alternative: Novu Cloud

If self-hosting is too complex, Novu Cloud offers:

- Free tier: 30,000 events/month
- No infrastructure management
- Faster setup

---

## API Integration Example

### Triggering a Notification

```typescript
// lib/notifications/index.ts
import { Novu } from "@novu/api";

const novu = new Novu({
  secretKey: process.env.NOVU_API_KEY!,
});

export async function notifyNewOrder(order: Order, store: Tenant) {
  // Get all staff members for this store
  const staffMembers = await getStoreStaff(store.id);

  for (const member of staffMembers) {
    await novu.trigger({
      name: "new-order",
      to: {
        subscriberId: member.userId,
        email: member.email,
      },
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: formatCurrency(order.totalAmount, "AFN"),
        itemCount: order.items.length,
        storeName: store.name,
        storeSlug: store.slug,
      },
      tenant: store.id, // Multi-tenant isolation
    });
  }
}
```

### React Component Integration

```tsx
// components/notifications/notification-bell.tsx
"use client";

import { Inbox } from "@novu/react";
import { useSession } from "@/lib/auth/client";

export function NotificationBell() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={session.user.id}
      appearance={{
        baseTheme: {
          variables: {
            colorPrimary: "oklch(0.65 0.2 145)",
            colorBackground: "white",
          },
        },
      }}
    />
  );
}
```

---

## Migration Strategy

### From Current web-push to Novu

1. **Keep web-push working** during migration
2. **Create Novu subscribers** for all existing users with push subscriptions
3. **Run both systems in parallel** for 1 week
4. **Migrate push subscriptions** to Novu's push provider
5. **Deprecate old system** after confirming Novu works

---

## Cost Analysis

### Self-Hosted Novu

- **Infrastructure**: ~$20/month (small VPS for MongoDB + Redis)
- **Maintenance**: Developer time for updates
- **Total**: ~$20/month + time

### Novu Cloud

- **Free tier**: 30,000 events/month
- **Pro**: $250/month for 1M events
- **Likely need**: Free tier sufficient for early stage

### Recommendation

Start with **Novu Cloud free tier** to validate, then migrate to **self-hosted** when you exceed limits or need more control.

---

## Success Metrics

| Metric                                 | Target      |
| -------------------------------------- | ----------- |
| Notification delivery rate             | > 99%       |
| Push notification opt-in rate          | > 60%       |
| In-app notification read rate          | > 40%       |
| Time to first notification (new order) | < 5 seconds |
| User preference completion rate        | > 30%       |

---

## References

- [Notification System Design - System Design Handbook](https://www.systemdesignhandbook.com/guides/design-a-notification-system/)
- [MagicBell - Notification System Design Best Practices](https://www.magicbell.com/blog/notification-system-design)
- [Novu GitHub - Open Source Notification Infrastructure](https://github.com/novuhq/novu)
- [Knock - Top Notification Infrastructure Platforms](https://knock.app/blog/the-top-notification-infrastructure-platforms-for-developers)
- [PubNub - E-commerce Push Notifications Guide 2025](https://www.pubnub.com/blog/ecommerce-push-notifications/)
- [Building Real-Time Notification Center in React](https://dev.to/nikl/building-a-real-time-notification-center-in-react-99b)
- [Novu React Components Documentation](https://novu.co/blog/building-open-source-react-components-for-real-time-notifications/)
