"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";

interface Campaign {
  id: string;
  name: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  scope: "store_wide" | "categories" | "products";
  badgeText: string | null;
}

interface SaleBannerProps {
  campaign: Campaign;
  storeSlug: string;
  currency?: string;
}

export function SaleBanner({
  campaign,
  storeSlug,
  currency: _currency,
}: SaleBannerProps) {
  const { format: formatPrice } = useCurrencyStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const pathname = usePathname();

  // Only show on store homepage
  const isHomepage = pathname === `/store/${storeSlug}`;
  if (!isHomepage) return null;

  if (isDismissed) return null;
  if (!campaign.name || !campaign.discountValue) return null;

  const discountValue = parseFloat(campaign.discountValue);
  const discountText =
    campaign.discountType === "percentage"
      ? `${Math.round(discountValue)}% OFF`
      : `${formatPrice(discountValue)} OFF`;

  return (
    <div className="bg-black text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
          <span className="rounded bg-red-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide sm:text-sm">
            Sale
          </span>
          <span className="text-sm sm:text-base">
            <span className="font-semibold">{campaign.name}</span>
            <span className="mx-1.5 text-gray-400">—</span>
            <span className="font-bold text-red-400">{discountText}</span>
          </span>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="ml-4 cursor-pointer rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
