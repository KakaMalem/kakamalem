# Offline Sync System — Enterprise Roadmap

> **Goal**: Make the Kaka Malem POS fully operational without an internet connection, with reliable data synchronization when connectivity is restored.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Industry Analysis](#industry-analysis)
3. [Current State Assessment](#current-state-assessment)
4. [Architecture Decision](#architecture-decision)
5. [Technology Selection](#technology-selection)
6. [Implementation Phases](#implementation-phases)
7. [Database & Schema Changes](#database--schema-changes)
8. [Conflict Resolution Strategy](#conflict-resolution-strategy)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Monitoring & Observability](#monitoring--observability)
12. [Rollout Plan](#rollout-plan)

---

## Executive Summary

The Afghan market presents unique connectivity challenges — frequent power outages, unstable mobile networks, and limited broadband infrastructure. A POS system that depends on constant server connectivity is unreliable in this environment. This roadmap defines how to build an offline-first POS that:

- Processes sales with zero network dependency
- Syncs data reliably when connectivity returns
- Handles conflicts (e.g., stock overselling) gracefully
- Prints receipts offline
- Preserves data integrity across outages

---

## Industry Analysis

### How Major Players Handle Offline POS

#### Shopify POS

- **Architecture**: Local-first with SQLite on device via their custom sync engine
- **Offline Scope**: Full product catalog cached locally, sales queued offline, barcode scanning works offline
- **Sync**: Bidirectional sync with conflict resolution; server is source of truth for catalog, device is source of truth for pending transactions
- **Payment**: Cash-only offline; card payments require connectivity (processor dependency)
- **Inventory**: Optimistic stock deduction locally, reconciled on sync — accepts oversell risk with admin alerts
- **Session**: Offline sessions can last days; transactions queue indefinitely until sync

#### Square POS

- **Architecture**: Store-and-forward pattern for transactions
- **Offline Scope**: Accepts payments offline (including card via stored encryption), queues for processing
- **Sync**: Sequential transaction replay on reconnect; strict ordering guarantees
- **Inventory**: Deferred stock updates — inventory only adjusts after successful sync
- **Limit**: 24-hour offline window for card transactions (fraud risk management)

#### Toast POS (Restaurant)

- **Architecture**: Hybrid local app with embedded database
- **Offline Scope**: Full menu, order management, kitchen display, receipt printing — all offline
- **Sync**: Event-sourced transaction log; append-only, replayed in order on sync
- **Key Insight**: Uses an event log (not state sync) — every action is an immutable event that gets replayed server-side

#### Lightspeed POS

- **Architecture**: Progressive Web App with IndexedDB
- **Offline Scope**: Product browsing and sales creation offline
- **Sync**: Operational Transform (OT) for catalog changes, queue-based for transactions
- **Key Insight**: Separates "reference data" (products, categories — server-owned) from "transactional data" (sales, payments — device-owned)

### Key Industry Patterns

| Pattern                        | Used By             | Description                                              |
| ------------------------------ | ------------------- | -------------------------------------------------------- |
| **Store-and-Forward**          | Square, Shopify     | Queue transactions locally, replay on sync               |
| **Event Sourcing**             | Toast, Clover       | Append-only event log, server replays to build state     |
| **CRDT-Based Sync**            | Linear, Figma       | Conflict-free data types that auto-merge                 |
| **Optimistic UI + Sync Queue** | All major POS       | Assume success locally, reconcile later                  |
| **Read Replica Pattern**       | Shopify, Lightspeed | Cache server data locally as read-only, transact locally |

### Industry Standard: Data Ownership Split

```
┌─────────────────────────────────────────────────────┐
│                   SERVER-OWNED DATA                  │
│         (Product catalog, categories, prices,        │
│          customer groups, store settings)             │
│                                                      │
│   → Periodically synced TO device (read replica)     │
│   → Device never modifies, only reads                │
│   → Server pushes updates when online                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   DEVICE-OWNED DATA                  │
│         (POS transactions, cart state, receipts,     │
│          offline payments, inventory movements)      │
│                                                      │
│   → Created on device, queued for sync               │
│   → Synced FROM device to server                     │
│   → Server validates and applies                     │
└─────────────────────────────────────────────────────┘
```

---

## Current State Assessment

### What Exists Today

| Component         | Status  | Notes                                                                                          |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------- |
| POS Terminal UI   | Done    | `components/dashboard/pos/pos-terminal.tsx` — full-screen POS with product grid, cart, payment |
| Product Search    | Done    | Server action `searchProductsForSale()` — requires network                                     |
| Sale Recording    | Done    | Server action `recordOfflineSale()` — requires network                                         |
| Barcode Scanner   | Done    | `components/dashboard/pos/barcode-scanner.tsx` — camera + USB support                          |
| Receipt Printing  | Done    | Thermal printer via Web Serial API — works client-side                                         |
| Zustand Stores    | Done    | `use-pos-products-store.ts` (in-memory only, lost on refresh)                                  |
| Service Worker    | Partial | `public/sw.js` — push notifications only, no caching                                           |
| PWA Manifest      | Missing | No `manifest.json`, not installable                                                            |
| IndexedDB         | Missing | No local persistence layer                                                                     |
| Offline Detection | Missing | No connectivity awareness                                                                      |
| Sync Engine       | Missing | No sync queue or conflict resolution                                                           |

### Current POS Data Flow (Online-Only)

```
User Action → Server Action → PostgreSQL → Response → UI Update
     ↓              ↓
  (blocked)    (blocked if offline)
```

### Target POS Data Flow (Offline-First)

```
User Action → Local IndexedDB → UI Update (instant)
                    ↓
              Sync Queue (background)
                    ↓
              Server Action → PostgreSQL
                    ↓
              Confirmation / Conflict Resolution
```

---

## Architecture Decision

### Recommended: Event-Sourced Sync Queue + Local Read Replica

After evaluating all approaches, the recommended architecture combines:

1. **Local Read Replica** (IndexedDB) for product catalog, categories, settings
2. **Event-Sourced Sync Queue** for transactions (sales, inventory movements)
3. **Service Worker** for asset caching and background sync
4. **Optimistic Local State** with server reconciliation

### Why This Approach

| Approach                       | Pros                                         | Cons                                                                        | Verdict                         |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| Full CRDT (Automerge/Yjs)      | Auto-merge, no conflicts                     | Complex, overkill for POS, large bundle                                     | Too complex                     |
| PowerSync                      | Excellent Postgres sync, partial replication | Requires PowerSync cloud service or self-hosted instance, vendor dependency | Strong candidate but adds infra |
| ElectricSQL                    | Native Postgres sync, CRDT-based             | Still maturing, requires Electric service                                   | Not production-ready enough     |
| Replicache                     | Battle-tested (used by Linear), great DX     | Requires server-side mutators, $499/mo at scale                             | Expensive for Afghan market     |
| Custom Event Queue + IndexedDB | Full control, no vendor lock-in, lightweight | More initial dev work                                                       | **Recommended**                 |

### Why Custom Over Managed Services

For the Afghan market context:

- **Cost**: No per-device or per-sync licensing fees
- **Control**: Full ownership of sync logic, tunable for Afghan network conditions
- **Simplicity**: Only sync what POS needs, not entire database
- **Independence**: No dependency on third-party sync infrastructure that may have latency issues from Afghanistan
- **Proven Pattern**: This is exactly what Shopify and Toast built internally

---

## Technology Selection

### Core Stack

| Component            | Technology                                                                                                                | Why                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Local Database**   | [Dexie.js](https://dexie.org/) v4+ (IndexedDB wrapper)                                                                    | Type-safe, reactive queries, excellent DX, 28KB gzipped, observable queries, battle-tested |
| **Sync Queue**       | Custom (built on Dexie)                                                                                                   | Event-sourced transaction log with retry logic                                             |
| **Service Worker**   | [Serwist](https://serwist.pages.dev/) (Workbox successor for Next.js)                                                     | Next.js 14+ native support, precaching, runtime caching, background sync                   |
| **PWA**              | [@ducanh2912/next-pwa](https://github.com/nicedoc/next-pwa) or Serwist                                                    | PWA manifest generation, SW registration                                                   |
| **Online Detection** | [navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) + custom heartbeat                  | Browser API + server ping for accurate detection                                           |
| **State Management** | Zustand + Dexie `liveQuery`                                                                                               | Zustand for ephemeral UI state, Dexie for persistent offline state                         |
| **Background Sync**  | [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) + fallback polling | Native browser API with manual fallback                                                    |
| **UUID Generation**  | `crypto.randomUUID()`                                                                                                     | Client-side ID generation for offline records                                              |
| **Data Validation**  | Zod (existing)                                                                                                            | Validate before local write AND before server sync                                         |

### Package Versions (as of Jan 2026)

```json
{
  "dexie": "^4.0.11",
  "dexie-react-hooks": "^1.1.7",
  "serwist": "^9.0.0",
  "@serwist/next": "^9.0.0",
  "idb-keyval": "^6.2.1",
  "uuid": "^11.0.0"
}
```

### Why Dexie.js Over Alternatives

| Library      | Size  | TypeScript | Reactive      | Sync Support           | Maturity                     |
| ------------ | ----- | ---------- | ------------- | ---------------------- | ---------------------------- |
| **Dexie.js** | 28KB  | Native     | `liveQuery()` | Dexie Cloud (optional) | 10+ years, 10K+ GitHub stars |
| `idb`        | 1.3KB | Yes        | No            | No                     | Google-maintained, minimal   |
| RxDB         | 45KB+ | Yes        | Full RxJS     | Built-in replication   | Heavy, RxJS dependency       |
| PouchDB      | 46KB  | Via types  | Changes feed  | CouchDB sync           | Aging, CouchDB-centric       |
| TinyBase     | 5KB   | Yes        | Yes           | CRDT sync              | Newer, less ecosystem        |

**Decision**: Dexie.js — right balance of features, size, maturity, and DX. Reactive `liveQuery()` integrates cleanly with React components. TypeScript-first. Optional Dexie Cloud available if we ever want managed sync.

---

## Implementation Phases

### Phase 1: Foundation — PWA & Local Storage

**Objective**: Make the POS installable and establish local data persistence.

#### 1.1 PWA Manifest & Installation

- [ ] Create `public/manifest.json` with POS-optimized settings
  ```json
  {
    "name": "Kaka Malem POS",
    "short_name": "KM POS",
    "display": "standalone",
    "orientation": "any",
    "start_url": "/dashboard",
    "scope": "/dashboard",
    "theme_color": "#000000",
    "background_color": "#ffffff",
    "categories": ["business", "shopping"],
    "icons": [
      {
        "src": "/icons/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png"
      },
      {
        "src": "/icons/icon-maskable-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "maskable"
      }
    ]
  }
  ```
- [ ] Add manifest link to root layout `<head>`
- [ ] Create app icons (192px, 512px, maskable)
- [ ] Add "Install App" prompt banner on POS page for non-installed users
- [ ] Add `<meta name="apple-mobile-web-app-capable" content="yes">` for iOS

#### 1.2 Service Worker with Serwist

- [ ] Install and configure `@serwist/next` in `next.config.ts`
- [ ] Create `app/sw.ts` (TypeScript service worker, replaces `public/sw.js`)
- [ ] Configure precaching for POS-critical assets:
  - POS page shell (HTML, JS, CSS)
  - Product placeholder images
  - Notification sounds (existing)
  - Font files
- [ ] Configure runtime caching strategies:
  - **NetworkFirst** for API routes (`/api/*`)
  - **CacheFirst** for static assets (`/icons/*`, fonts, images)
  - **StaleWhileRevalidate** for product images
- [ ] Migrate existing push notification SW code into the new Serwist-based SW
- [ ] Add offline fallback page for non-POS routes

#### 1.3 Dexie.js Local Database

- [ ] Install `dexie` and `dexie-react-hooks`
- [ ] Create `lib/offline/db.ts` — Dexie database definition:

  ```typescript
  import Dexie, { type EntityTable } from 'dexie';

  interface OfflineProduct {
    id: string;
    name: string;
    price: string;
    sku: string | null;
    barcode: string | null;
    stock: number;
    trackInventory: boolean;
    hasVariants: boolean;
    categoryIds: string[];
    imageUrl: string | null;
    showOnPos: boolean;
    lastSyncedAt: string;
  }

  interface OfflineVariant {
    id: string;
    productId: string;
    displayName: string;
    sku: string | null;
    barcode: string | null;
    price: string | null;
    stock: number;
  }

  interface OfflineCategory {
    id: string;
    name: string;
    displayOrder: number;
    productCount: number;
  }

  interface OfflineStoreSettings {
    tenantId: string;
    storeName: string;
    currency: string;
    storePhone: string | null;
    receiptFooterText: string | null;
    posScannerMode: 'camera' | 'usb';
    receiptPrintMode: string;
    receiptPaperWidth: '58mm' | '80mm';
    lastSyncedAt: string;
  }

  interface SyncQueueItem {
    id?: number; // Auto-increment
    type: 'sale' | 'payment' | 'stock_adjustment';
    payload: Record<string, unknown>;
    status: 'pending' | 'syncing' | 'synced' | 'failed';
    attempts: number;
    maxAttempts: number;
    createdAt: string;
    lastAttemptAt: string | null;
    errorMessage: string | null;
    clientId: string; // Idempotency key
  }

  interface OfflineReceipt {
    id: string;
    orderNumber: string;
    receiptNumber: string;
    items: Array<{...}>;
    total: string;
    paidAmount: string;
    paymentMethod: string;
    createdAt: string;
    syncStatus: 'pending' | 'synced';
  }

  const db = new Dexie('KakaMalemPOS') as Dexie & {
    products: EntityTable<OfflineProduct, 'id'>;
    variants: EntityTable<OfflineVariant, 'id'>;
    categories: EntityTable<OfflineCategory, 'id'>;
    storeSettings: EntityTable<OfflineStoreSettings, 'tenantId'>;
    syncQueue: EntityTable<SyncQueueItem, 'id'>;
    receipts: EntityTable<OfflineReceipt, 'id'>;
  };

  db.version(1).stores({
    products: 'id, barcode, sku, *categoryIds, showOnPos',
    variants: 'id, productId, barcode, sku',
    categories: 'id, displayOrder',
    storeSettings: 'tenantId',
    syncQueue: '++id, status, type, clientId, createdAt',
    receipts: 'id, orderNumber, syncStatus, createdAt',
  });

  export { db };
  ```

- [ ] Create `lib/offline/hooks.ts` — React hooks wrapping Dexie `liveQuery`:
  - `useOfflineProducts(tenantId, categoryId?, search?)`
  - `useOfflineCategories(tenantId)`
  - `useOfflineStoreSettings(tenantId)`
  - `useSyncQueueCount()` — pending sync items count
  - `useOfflineReceipts(tenantId)`
- [ ] Create `lib/offline/seed.ts` — initial data load from server to IndexedDB

#### 1.4 Connectivity Detection

- [ ] Create `lib/offline/connectivity.ts`:

  ```typescript
  // Multi-signal connectivity detection
  // 1. navigator.onLine (browser API — catches cable unplug, Wi-Fi off)
  // 2. Heartbeat ping to /api/health (catches server down, DNS issues)
  // 3. Exponential backoff on failures

  type ConnectivityStatus = "online" | "offline" | "degraded";
  ```

- [ ] Create `useConnectivity()` Zustand store with:
  - Real-time status tracking
  - Toast notifications on status change
  - Heartbeat interval (30s online, 5s when recovering)
  - Network quality estimation (RTT-based)
- [ ] Add connectivity indicator to POS UI header (green/yellow/red dot)

---

### Phase 2: Offline Product Catalog

**Objective**: POS can browse and search products without network.

#### 2.1 Catalog Sync (Server → Device)

- [ ] Create `lib/offline/sync/catalog-sync.ts`:
  - Full sync on first load (all POS-visible products)
  - Incremental sync using `updatedAt` watermark (only fetch changes since last sync)
  - Batch processing (100 products per batch to avoid memory pressure)
  - Image URL caching (Cache API for product thumbnails)
- [ ] Create server API endpoint `GET /api/pos/catalog-sync`:
  ```typescript
  // Query params: tenantId, since (ISO timestamp), limit, offset
  // Returns: { products, variants, categories, hasMore, syncTimestamp }
  // Includes: deleted product IDs for local cleanup
  ```
- [ ] Handle catalog sync edge cases:
  - Product deleted on server → remove from IndexedDB
  - Product price changed → update local copy
  - New category added → insert locally
  - Product removed from POS visibility → remove from local POS cache
- [ ] Add "Last synced: X minutes ago" indicator to POS UI
- [ ] Add manual "Sync Now" button for catalog refresh
- [ ] Pre-cache product images via Service Worker Cache API

#### 2.2 Offline Product Search

- [ ] Replace `searchProductsForSale` server action calls with local IndexedDB queries
- [ ] Implement Dexie-based search:
  - Name search: `db.products.where('name').startsWithIgnoreCase(query)`
  - Barcode scan: `db.products.where('barcode').equals(code)` (exact match)
  - SKU search: `db.products.where('sku').startsWithIgnoreCase(query)`
  - Variant barcode: `db.variants.where('barcode').equals(code)` → resolve to product
  - Category filter: `db.products.where('categoryIds').equals(categoryId)`
- [ ] Full-text search fallback using Dexie's `filter()` for substring matching
- [ ] Update `use-pos-products-store.ts` to source data from Dexie instead of server

#### 2.3 Offline Category Browsing

- [ ] Sync categories to IndexedDB alongside products
- [ ] Update POS category tabs to read from local DB
- [ ] Maintain category product counts locally

---

### Phase 3: Offline Sales & Sync Queue

**Objective**: Record sales offline and sync them reliably.

#### 3.1 Client-Side Sale Recording

- [ ] Create `lib/offline/actions/record-sale.ts`:

  ```typescript
  async function recordOfflineSaleLocally(
    input: RecordOfflineSaleInput
  ): Promise<OfflineSaleResult> {
    // 1. Generate client-side IDs
    const clientOrderId = crypto.randomUUID();
    const clientReceiptNumber = generateLocalReceiptNumber(); // RCP-LOCAL-{timestamp}

    // 2. Validate stock locally (optimistic)
    // 3. Deduct stock in IndexedDB
    // 4. Create receipt in IndexedDB
    // 5. Add to sync queue
    // 6. Return immediately (instant UX)
  }
  ```

- [ ] Implement client-side order number generation:
  - Format: `KM-LOCAL-{YYYYMMDD}-{sequence}` (distinguishable from server-generated)
  - Server assigns final `KM-{YEAR}-{sequence}` on sync
  - Receipt shows local number; reprints show final number after sync
- [ ] Implement local stock deduction:
  - Deduct from IndexedDB `products.stock` / `variants.stock`
  - Track deductions in local `inventory_movements` table
  - Flag products with stock warnings (approaching zero)
- [ ] Create offline receipt storage for reprint capability

#### 3.2 Sync Queue Engine

- [ ] Create `lib/offline/sync/sync-engine.ts`:
  ```typescript
  class SyncEngine {
    // Process queue items in FIFO order
    // Retry with exponential backoff (1s, 2s, 4s, 8s, 16s, max 5min)
    // Max 10 retry attempts before marking as 'failed'
    // Idempotency via clientId — server deduplicates
    // Batch processing (up to 10 items per sync cycle)
    // Pause on connectivity loss, resume on restore
  }
  ```
- [ ] Implement sync lifecycle:
  ```
  pending → syncing → synced ✓
       ↘ failed (after max retries) → manual retry
  ```
- [ ] Add Background Sync API registration:
  ```typescript
  // In service worker:
  self.addEventListener("sync", (event) => {
    if (event.tag === "pos-transaction-sync") {
      event.waitUntil(processSyncQueue());
    }
  });
  ```
- [ ] Fallback: polling-based sync for browsers without Background Sync (Safari)
- [ ] Sync status UI component showing:
  - Pending items count (badge on sync icon)
  - Currently syncing animation
  - Failed items with retry button
  - Last successful sync timestamp

#### 3.3 Server-Side Sync Endpoint

- [ ] Create `POST /api/pos/sync` endpoint:
  ```typescript
  // Accepts: Array of sync events
  // Each event has clientId for idempotency
  // Server processes in order
  // Returns: { results: Array<{ clientId, status, serverOrderId?, error? }> }
  ```
- [ ] Server-side idempotency:
  - Store `clientId` in orders table (new column)
  - Check for existing order with same `clientId` before insert
  - Return existing order data if duplicate detected
- [ ] Server-side validation:
  - Re-validate stock (may have changed since device cached)
  - Generate final order numbers (KM-{YEAR}-{sequence})
  - Generate final receipt numbers (RCP-{YEAR}-{sequence})
  - Map local IDs to server IDs in response
- [ ] Handle partial sync failures:
  - Each item in batch processed independently
  - Failed items returned with error details
  - Client retries only failed items

#### 3.4 Inventory Reconciliation

- [ ] On sync: compare local stock with server stock
- [ ] If server stock < local deduction amount:
  - Sale still goes through (already committed to customer)
  - Flag as "stock oversold" event
  - Create admin notification: "Product X oversold by Y units during offline period"
  - Admin reviews and adjusts (accept backorder, cancel partial, restock)
- [ ] Post-sync: refresh local stock from server (source of truth)
- [ ] Create dashboard widget: "Offline Sales Pending Sync" with count and total value

---

### Phase 4: Advanced Offline Capabilities

**Objective**: Full-featured offline POS with edge case handling.

#### 4.1 Offline Receipt Printing

- [ ] Receipt printing already uses Web Serial API (client-side) — works offline
- [ ] Store receipt data in IndexedDB for reprint capability
- [ ] Add "Pending Sync" indicator on receipts printed offline
- [ ] After sync: update receipt with final server order number
- [ ] Receipt reprint pulls from local DB (instant, no network needed)

#### 4.2 Offline Payment Handling

- [ ] Cash payments: fully offline (no processor needed)
- [ ] Record payment method and amount locally
- [ ] Partial payment tracking offline (multiple payments per order)
- [ ] "Pay Later" support: create unpaid order offline, sync when online
- [ ] Future: integrate mobile money APIs (M-Paisa, Afghan Wireless) with offline queuing

#### 4.3 Multi-Device Sync Awareness

- [ ] Each device gets a unique `deviceId` (stored in localStorage)
- [ ] All offline transactions tagged with `deviceId`
- [ ] Server tracks last sync per device
- [ ] Dashboard shows per-device sync status:
  ```
  Device: iPad-POS-1    Last sync: 2 minutes ago    Pending: 0
  Device: Android-POS-2  Last sync: 45 minutes ago   Pending: 12 ⚠️
  ```
- [ ] Conflict detection: same product sold on multiple devices while both offline
  - Resolution: both sales are valid (customer already has product)
  - Stock may go negative — admin alert generated
  - Server applies sales in chronological order (client timestamps)

#### 4.4 Offline Session Management

- [ ] Cache auth session in IndexedDB (encrypted):
  - User ID, tenant ID, role, permissions
  - Session expiry extended for offline use (24 hours from last online auth)
  - Re-authenticate on next online connection
- [ ] Staff PIN for quick switch (no network needed):
  - PINs cached locally (hashed)
  - Full re-auth required on next sync
- [ ] Audit log: track all offline actions with timestamps and device IDs

#### 4.5 Data Retention & Cleanup

- [ ] Auto-purge synced queue items after 7 days
- [ ] Auto-purge synced receipts after 30 days (keep on server)
- [ ] Product catalog: keep full catalog locally (typically < 50MB for most stores)
- [ ] Monitor IndexedDB storage usage:
  - Warn at 80% of quota
  - `navigator.storage.estimate()` for usage tracking
  - `navigator.storage.persist()` to prevent eviction

---

### Phase 5: Resilience & Edge Cases

**Objective**: Handle every failure mode gracefully.

#### 5.1 Failure Scenarios & Handling

| Scenario                        | Handling                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Network drops mid-sale          | Sale already local — no impact. Sync retries later.                              |
| Network drops mid-sync          | Idempotency keys prevent duplicates. Retry from last unsynced item.              |
| Device crashes during sale      | Dexie transactions are atomic. Either fully saved or not.                        |
| Browser clears IndexedDB        | `navigator.storage.persist()` prevents this. Fallback: full re-sync from server. |
| Server down for hours           | Unlimited offline queue. All sales continue. Sync when server returns.           |
| Clock skew between devices      | Use server timestamp on sync. Client timestamps for ordering only.               |
| Concurrent edits (multi-device) | Last-write-wins for catalog. Append-only for transactions (no conflicts).        |
| IndexedDB quota exceeded        | Alert user. Purge old synced data. Compress stored data.                         |
| Service worker update           | Skipwaiting + reload prompt. Migrate Dexie schema if needed.                     |
| Customer refund while offline   | Queue refund event. Stock adjustment on sync.                                    |

#### 5.2 Data Integrity Guarantees

- [ ] All local writes wrapped in Dexie transactions (atomic)
- [ ] Sync queue items are immutable once created (append-only)
- [ ] Server validates every synced transaction (not blind trust)
- [ ] Checksums on sync payloads (detect corruption)
- [ ] Idempotency keys on every transaction (prevent duplicates)
- [ ] Monotonic client sequence numbers per device (detect gaps)

#### 5.3 Offline Duration Limits

| Duration    | Behavior                                                    |
| ----------- | ----------------------------------------------------------- |
| < 1 hour    | Normal operation, auto-sync on reconnect                    |
| 1-24 hours  | Normal operation, admin notification                        |
| 24-72 hours | Warning banner, encourage sync, session re-auth required    |
| > 72 hours  | Forced catalog re-sync before new sales, stock may be stale |

---

## Database & Schema Changes

### New Columns on Existing Tables

```sql
-- orders table: add idempotency and device tracking
ALTER TABLE orders ADD COLUMN client_id TEXT UNIQUE;
ALTER TABLE orders ADD COLUMN device_id TEXT;
ALTER TABLE orders ADD COLUMN offline_created_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN sync_status TEXT DEFAULT 'online';
-- sync_status: 'online' | 'synced' | 'conflict'

CREATE INDEX idx_orders_client_id ON orders(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_orders_device_id ON orders(device_id) WHERE device_id IS NOT NULL;
```

### New Tables

```sql
-- Track device registrations and sync state
CREATE TABLE pos_devices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_online_at TIMESTAMPTZ,
  pending_sync_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  registered_by TEXT REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, device_fingerprint)
);

-- Sync event log (audit trail)
CREATE TABLE sync_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES pos_devices(id),
  event_type TEXT NOT NULL, -- 'sale' | 'payment' | 'stock_adjustment' | 'full_sync' | 'catalog_sync'
  client_id TEXT, -- Idempotency key from client
  status TEXT NOT NULL, -- 'success' | 'conflict' | 'error'
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_events_tenant ON sync_events(tenant_id, created_at DESC);
CREATE INDEX idx_sync_events_device ON sync_events(device_id, created_at DESC);

-- Stock conflict log
CREATE TABLE stock_conflicts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  expected_stock INTEGER NOT NULL,
  actual_stock INTEGER NOT NULL,
  oversold_quantity INTEGER NOT NULL,
  order_id TEXT REFERENCES orders(id),
  device_id TEXT REFERENCES pos_devices(id),
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Drizzle Schema Additions

Add to `lib/db/schema.ts`:

```typescript
export const posDevices = pgTable(
  "pos_devices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    deviceName: text("device_name").notNull(),
    deviceFingerprint: text("device_fingerprint").notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    lastOnlineAt: timestamp("last_online_at"),
    pendingSyncCount: integer("pending_sync_count").default(0),
    isActive: boolean("is_active").default(true),
    registeredBy: text("registered_by").references(() => profiles.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("pos_devices_tenant_fingerprint").on(
      table.tenantId,
      table.deviceFingerprint
    ),
  ]
);

export const syncEvents = pgTable("sync_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: text("device_id")
    .notNull()
    .references(() => posDevices.id),
  eventType: text("event_type").notNull(),
  clientId: text("client_id"),
  status: text("status").notNull(),
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stockConflicts = pgTable("stock_conflicts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  variantId: text("variant_id").references(() => productVariants.id),
  expectedStock: integer("expected_stock").notNull(),
  actualStock: integer("actual_stock").notNull(),
  oversoldQuantity: integer("oversold_quantity").notNull(),
  orderId: text("order_id").references(() => orders.id),
  deviceId: text("device_id").references(() => posDevices.id),
  resolved: boolean("resolved").default(false),
  resolvedBy: text("resolved_by").references(() => profiles.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Conflict Resolution Strategy

### Taxonomy of Conflicts

| Conflict Type                      | Frequency             | Severity | Resolution                                     |
| ---------------------------------- | --------------------- | -------- | ---------------------------------------------- |
| **Stock Oversell**                 | Common (multi-device) | Medium   | Accept sale, alert admin, backorder or restock |
| **Price Changed During Offline**   | Rare                  | Low      | Honor offline price (customer already paid)    |
| **Product Deleted During Offline** | Very Rare             | Medium   | Sale still valid, flag for admin review        |
| **Duplicate Transaction**          | Possible (retry)      | High     | Idempotency key deduplication (automatic)      |
| **Category Reorganized**           | Rare                  | None     | Next catalog sync picks up changes             |
| **User Permissions Revoked**       | Very Rare             | High     | Reject on sync, admin notification             |

### Resolution Rules

1. **Transactions are sacred**: Once a sale is recorded locally and a receipt is printed, it is committed. The server MUST accept it (possibly with warnings).
2. **Server is source of truth for catalog**: Product data, prices, categories — server always wins.
3. **Device is source of truth for its transactions**: Each device's transaction log is authoritative for its own sales.
4. **Stock conflicts are advisory**: Overselling generates alerts but does not reject sales.
5. **Chronological ordering**: When order matters, use client-side timestamps (with server adjustment for clock skew).

### Conflict Resolution Flow

```
Device syncs sale → Server checks stock
                 ↓
         Stock sufficient? → YES → Apply sale, confirm
                 ↓ NO
         Sale already committed (receipt printed)?
                 ↓ YES
         Apply sale anyway → Create stock_conflict record → Notify admin
                 ↓
         Admin resolves: restock / accept backorder / adjust inventory
```

---

## Security Considerations

### Data at Rest (IndexedDB)

- [ ] **Do NOT store**: auth tokens, passwords, payment card numbers, BETTER_AUTH_SECRET
- [ ] **OK to store**: product catalog, prices, order history, receipt data, sync queue
- [ ] IndexedDB is per-origin isolated (browser security model)
- [ ] Use `navigator.storage.persist()` to prevent silent eviction
- [ ] Consider encrypting sensitive fields (customer phone numbers) with Web Crypto API:
  ```typescript
  // Key derived from user session, stored in memory only
  const key = await crypto.subtle.deriveKey(/*...*/);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  ```

### Sync Security

- [ ] All sync requests go through existing auth middleware (Better Auth session cookie)
- [ ] Sync endpoint validates `tenantId` matches authenticated user's store
- [ ] Rate limiting on sync endpoint (prevent abuse)
- [ ] Payload size limits (max 5MB per sync batch)
- [ ] Server-side validation of all synced data (never trust client data blindly)

### Device Management

- [ ] Device registration requires authenticated user
- [ ] Admins can deactivate devices from dashboard
- [ ] Deactivated device's pending sync is rejected with "device revoked" error
- [ ] Device fingerprinting for identification (not security — just tracking)

---

## Testing Strategy

### Unit Tests

- [ ] Dexie database operations (CRUD, transactions, queries)
- [ ] Sync queue logic (enqueue, dequeue, retry, idempotency)
- [ ] Conflict resolution rules
- [ ] Offline sale recording (local flow)
- [ ] Connectivity detection state machine

### Integration Tests

- [ ] Full offline sale → sync → server reconciliation flow
- [ ] Multi-device concurrent sales → sync → stock reconciliation
- [ ] Catalog sync (full and incremental)
- [ ] Service worker caching behavior
- [ ] Background sync trigger and processing

### E2E Tests (Playwright)

- [ ] Simulate offline: `page.context().setOffline(true)`
- [ ] Record sale while offline → go online → verify synced to server
- [ ] Product search works offline
- [ ] Receipt printing works offline
- [ ] Connectivity indicator reflects actual state
- [ ] PWA installation flow
- [ ] Sync queue processes in correct order

### Chaos Testing

- [ ] Network flapping (rapid online/offline toggling)
- [ ] Mid-sync disconnection
- [ ] Server returning 500 during sync
- [ ] IndexedDB full (quota exceeded)
- [ ] Multiple tabs open simultaneously
- [ ] Device clock set to wrong time

---

## Monitoring & Observability

### Client-Side Metrics (sent on sync)

```typescript
interface OfflineMetrics {
  deviceId: string;
  offlineDuration: number; // seconds spent offline
  transactionsWhileOffline: number;
  syncQueueSize: number;
  syncDuration: number; // ms for last sync
  syncErrors: number;
  indexedDbUsage: number; // bytes
  catalogAge: number; // seconds since last catalog sync
}
```

### Server-Side Monitoring

- [ ] Dashboard: "Offline Sync Health" panel
  - Devices currently offline (by last heartbeat)
  - Pending sync volume across all devices
  - Sync error rate (last 24h)
  - Average sync latency
  - Stock conflict rate
- [ ] Alerts:
  - Device offline > 4 hours
  - Sync queue > 100 items on any device
  - Sync error rate > 5%
  - Stock conflict on high-value product
- [ ] Audit log: all sync events stored in `sync_events` table

### Analytics Integration

- [ ] Track offline vs online sales ratio per store
- [ ] Track average offline duration per device
- [ ] Track sync failure rate over time
- [ ] Track stock conflict frequency

---

## Rollout Plan

### Stage 1: Internal Testing

- Deploy to staging environment
- Test with 2-3 internal stores
- Simulate Afghan network conditions (throttled, intermittent)
- Validate all failure scenarios

### Stage 2: Beta (5-10 Stores)

- Enable for selected stores via feature flag
- Monitor sync health metrics closely
- Collect feedback on UX (offline indicator, sync status)
- Iterate on conflict resolution UX

### Stage 3: General Availability

- Enable for all stores with `store_mode` including offline (`full`, `offline_only`)
- Documentation and training materials (Dari/Pashto)
- In-app onboarding for offline POS setup
- Support playbook for sync issues

### Feature Flags

```typescript
// lib/feature-flags.ts
export const OFFLINE_POS_ENABLED =
  process.env.NEXT_PUBLIC_OFFLINE_POS === "true";

// Usage in POS page:
if (OFFLINE_POS_ENABLED) {
  // Use offline-first flow
} else {
  // Existing online-only flow
}
```

---

## File Structure (New Files)

```
lib/
├── offline/
│   ├── db.ts                    # Dexie database definition
│   ├── hooks.ts                 # React hooks for offline data
│   ├── connectivity.ts          # Online/offline detection
│   ├── device.ts                # Device registration & fingerprinting
│   ├── seed.ts                  # Initial data load (server → IndexedDB)
│   ├── actions/
│   │   ├── record-sale.ts       # Offline sale recording
│   │   ├── record-payment.ts    # Offline payment recording
│   │   └── stock-adjustment.ts  # Local stock changes
│   └── sync/
│       ├── sync-engine.ts       # Core sync orchestrator
│       ├── catalog-sync.ts      # Server → device catalog sync
│       ├── transaction-sync.ts  # Device → server transaction sync
│       ├── conflict-resolver.ts # Conflict detection & resolution
│       └── retry-strategy.ts    # Exponential backoff logic
├── stores/
│   └── use-connectivity-store.ts  # Zustand store for online status
│
app/
├── sw.ts                        # Serwist service worker (replaces public/sw.js)
├── api/pos/
│   ├── catalog-sync/route.ts    # GET - catalog sync endpoint
│   ├── sync/route.ts            # POST - transaction sync endpoint
│   └── device/route.ts          # POST/GET - device registration
│
public/
├── manifest.json                # PWA manifest
├── icons/
│   ├── icon-192x192.png
│   ├── icon-512x512.png
│   └── icon-maskable-512x512.png
│
components/dashboard/pos/
├── connectivity-indicator.tsx   # Online/offline status dot
├── sync-status-badge.tsx        # Pending sync count badge
├── offline-banner.tsx           # "You are offline" banner
└── sync-queue-panel.tsx         # Detailed sync queue view
```

---

## Estimated Complexity by Phase

| Phase                             | Scope                        | New Files | Modified Files |
| --------------------------------- | ---------------------------- | --------- | -------------- |
| **Phase 1**: PWA & Local Storage  | Foundation                   | ~10       | ~5             |
| **Phase 2**: Offline Catalog      | Product browsing offline     | ~5        | ~4             |
| **Phase 3**: Offline Sales & Sync | Core offline capability      | ~10       | ~8             |
| **Phase 4**: Advanced Features    | Multi-device, receipts, auth | ~6        | ~5             |
| **Phase 5**: Resilience           | Edge cases, monitoring       | ~4        | ~3             |

---

## References

- [Shopify POS Architecture (2024)](https://shopify.engineering/building-a-mobile-app-that-works-offline) — Local-first mobile POS design
- [Martin Kleppmann — Designing Data-Intensive Applications](https://dataintensive.net/) — Event sourcing, CRDTs, distributed systems
- [Dexie.js Documentation](https://dexie.org/docs/) — IndexedDB wrapper API
- [Serwist Documentation](https://serwist.pages.dev/) — Next.js service worker framework
- [Web Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [PWA Builder](https://www.pwabuilder.com/) — PWA manifest and icon generation
- [Local-First Software](https://www.inkandswitch.com/local-first/) — Ink & Switch research paper on local-first architectures
