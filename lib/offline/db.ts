"use client";

import Dexie, { type EntityTable } from "dexie";

// ============================================================================
// TABLE INTERFACES
// ============================================================================

/** Product cached for offline POS use (read replica of server data) */
export interface OfflineProduct {
  id: string; // Primary key, matches server product ID
  tenantId: string;
  name: string;
  price: string; // Decimal as string (matches server format)
  sku: string | null;
  barcode: string | null;
  stock: number;
  trackInventory: boolean;
  hasVariants: boolean;
  categoryId: string | null; // Direct category FK
  categoryIds: string[]; // All categories (many-to-many)
  imageUrl: string | null;
  showOnPos: boolean;
  lastSyncedAt: string; // ISO timestamp
}

/** Product variant cached for offline POS use */
export interface OfflineVariant {
  id: string; // Primary key, matches server variant ID
  productId: string; // FK to OfflineProduct
  tenantId: string;
  displayName: string;
  sku: string | null;
  barcode: string | null;
  price: string | null; // Null means use product price
  stock: number;
  isActive: boolean;
}

/** Category cached for offline POS use */
export interface OfflineCategory {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  imageUrl: string | null;
  productCount: number;
}

/** Store settings cached for offline POS use */
export interface OfflineStoreSettings {
  tenantId: string; // Primary key
  storeName: string;
  currency: string;
  storePhone: string | null;
  receiptFooterText: string | null;
  posScannerMode: "camera" | "usb";
  receiptPrintMode: string;
  receiptPaperWidth: "58mm" | "80mm";
  storeMode: string;
  lastSyncedAt: string;
}

/** Sync queue item -- transactions waiting to be synced to server */
export interface SyncQueueItem {
  id?: number; // Auto-increment primary key
  type: "sale" | "payment" | "stock_adjustment";
  tenantId: string;
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "synced" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: string; // ISO timestamp
  lastAttemptAt: string | null;
  errorMessage: string | null;
  clientId: string; // Idempotency key (UUID)
}

/** Receipt stored locally for offline reprint capability */
export interface OfflineReceipt {
  id: string; // Client-generated UUID
  tenantId: string;
  orderNumber: string;
  receiptNumber: string;
  items: Array<{
    productName: string;
    variantName: string | null;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  paymentMethod: string | null;
  customerName: string | null;
  createdAt: string;
  syncStatus: "pending" | "synced";
  serverOrderId: string | null; // Assigned after sync
}

// ============================================================================
// DATABASE DEFINITION
// ============================================================================

export const posDb = new Dexie("KakaMalemPOS") as Dexie & {
  products: EntityTable<OfflineProduct, "id">;
  variants: EntityTable<OfflineVariant, "id">;
  categories: EntityTable<OfflineCategory, "id">;
  storeSettings: EntityTable<OfflineStoreSettings, "tenantId">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
  receipts: EntityTable<OfflineReceipt, "id">;
};

posDb.version(1).stores({
  // Index format: 'primaryKey, index1, index2, *multiValueIndex'
  products:
    "id, tenantId, barcode, sku, *categoryIds, showOnPos, [tenantId+showOnPos]",
  variants: "id, productId, tenantId, barcode, sku",
  categories: "id, tenantId, displayOrder, [tenantId+displayOrder]",
  storeSettings: "tenantId",
  syncQueue: "++id, status, type, clientId, createdAt, [status+createdAt]",
  receipts: "id, tenantId, orderNumber, syncStatus, createdAt",
});

export type { Dexie };
