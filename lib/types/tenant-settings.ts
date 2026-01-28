import type {
  StoreMode,
  ReceiptPaperWidth,
  PosScannerMode,
  ReceiptPrintMode,
} from "@/lib/validations/stores";

/**
 * Tenant settings type for client-side state management.
 * This is a subset of the full tenant data, focused on settings
 * that need to be accessed across the dashboard.
 */
export type TenantSettings = {
  // Core identifiers
  id: string;
  slug: string;
  name: string;

  // Branding
  logoUrl: string | null;
  faviconUrl: string | null;
  tagline: string | null;

  // Contact
  contactEmail: string | null;
  contactPhone: string | null;

  // Settings
  currency: string;

  // Store Mode
  storeMode: StoreMode;
  onlineCheckoutEnabled: boolean;
  posEnabled: boolean;
  phoneOrdersEnabled: boolean;

  // POS Settings
  posScannerMode: PosScannerMode;

  // Receipt Settings
  receiptPaperWidth: ReceiptPaperWidth;
  receiptShowLogo: boolean;
  receiptShowContact: boolean;
  receiptFooterText: string | null;
  receiptPrintMode: ReceiptPrintMode;

  // Delivery
  enableDeliveryZones: boolean;
};
