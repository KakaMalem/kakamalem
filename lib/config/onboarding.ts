import type { OnboardingChecklistItem } from "@/lib/db/schema";

export type StoreMode = "full" | "online_only" | "offline_only" | "catalog";

/**
 * Get onboarding checklist items based on store mode
 * Items are personalized to help users set up their specific type of store
 */
export function getOnboardingItemsForMode(
  storeMode: StoreMode,
  storeSlug: string
): OnboardingChecklistItem[] {
  const items: OnboardingChecklistItem[] = [];

  // Base item: Add first product (all store modes)
  items.push({
    id: "add_product",
    label: "Add your first product",
    description: "List a product with images and pricing",
    href: `/dashboard/${storeSlug}/products/new`,
    completed: false,
  });

  // Online stores: Set up delivery
  if (storeMode === "online_only" || storeMode === "full") {
    items.push({
      id: "setup_shipping",
      label: "Set up delivery zones",
      description: "Configure where and how you deliver",
      href: `/dashboard/${storeSlug}/settings/delivery`,
      completed: false,
    });
  }

  // Catalog stores: Add contact info
  if (storeMode === "catalog") {
    items.push({
      id: "add_contact",
      label: "Add contact information",
      description: "Help customers reach you via WhatsApp or phone",
      href: `/dashboard/${storeSlug}/settings/social`,
      completed: false,
    });
  }

  // Base item: Customize store (all modes)
  items.push({
    id: "customize_store",
    label: "Customize your store",
    description: "Add branding, social links, and SEO settings",
    href: `/dashboard/${storeSlug}/settings`,
    completed: false,
  });

  // Base item: Share store (all modes)
  items.push({
    id: "share_store",
    label: "Share your store",
    description: "Copy your store link and share it with customers",
    href: `/store/${storeSlug}`,
    completed: false,
  });

  return items;
}

/**
 * Store type display configuration for the wizard
 */
export const STORE_TYPE_OPTIONS = [
  {
    mode: "online_only" as const,
    title: "Online Store",
    description: "Sell products through your website with online checkout",
    icon: "Globe",
    recommended: true,
  },
  {
    mode: "offline_only" as const,
    title: "Physical Store",
    description: "Record in-person sales with point of sale",
    icon: "Store",
    recommended: false,
  },
  {
    mode: "full" as const,
    title: "Both (Omnichannel)",
    description: "Online store + in-person sales recording",
    icon: "ShoppingBag",
    recommended: false,
  },
  {
    mode: "catalog" as const,
    title: "Catalog Only",
    description: "Showcase products, customers contact you to order",
    icon: "Images",
    recommended: false,
  },
] as const;
