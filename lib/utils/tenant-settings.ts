import type { TenantSettings } from "@/lib/types/tenant-settings";

/**
 * Transform raw tenant data from DB to TenantSettings type.
 * This function can be used on both server and client.
 */
export function transformTenantToSettings(tenant: {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  tagline: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  storeMode: "full" | "online_only" | "offline_only" | "catalog";
  onlineCheckoutEnabled: boolean;
  posEnabled: boolean;
  phoneOrdersEnabled: boolean;
  posScannerMode: string;
  receiptPaperWidth: string;
  receiptShowLogo: boolean;
  receiptShowContact: boolean;
  receiptFooterText: string | null;
  enableDeliveryZones: boolean;
}): TenantSettings {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logoUrl: tenant.logoUrl,
    faviconUrl: tenant.faviconUrl,
    tagline: tenant.tagline,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    currency: tenant.currency,
    storeMode: tenant.storeMode,
    onlineCheckoutEnabled: tenant.onlineCheckoutEnabled,
    posEnabled: tenant.posEnabled,
    phoneOrdersEnabled: tenant.phoneOrdersEnabled,
    posScannerMode: tenant.posScannerMode as "camera" | "usb",
    receiptPaperWidth: tenant.receiptPaperWidth as "80mm" | "58mm",
    receiptShowLogo: tenant.receiptShowLogo,
    receiptShowContact: tenant.receiptShowContact,
    receiptFooterText: tenant.receiptFooterText,
    enableDeliveryZones: tenant.enableDeliveryZones,
  };
}
