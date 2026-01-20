"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Globe, Store, ShoppingBag, Images } from "lucide-react";
import { generateSlug } from "@/lib/validations/stores";
import type { StoreMode } from "@/lib/config/onboarding";

interface StorePreviewCardProps {
  name: string;
  tagline: string;
  logoUrl: string | null;
  headerDisplay: "logo_only" | "name_only" | "logo_and_name";
  storeMode: StoreMode;
}

const storeModeIcons: Record<StoreMode, typeof Globe> = {
  online_only: Globe,
  offline_only: Store,
  full: ShoppingBag,
  catalog: Images,
};

const storeModeLabels: Record<StoreMode, string> = {
  online_only: "Online Store",
  offline_only: "Physical Store",
  full: "Omnichannel",
  catalog: "Catalog",
};

export function StorePreviewCard({
  name,
  tagline,
  logoUrl,
  headerDisplay,
  storeMode,
}: StorePreviewCardProps) {
  const slug = generateSlug(name) || "your-store";
  const ModeIcon = storeModeIcons[storeMode];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-4"
    >
      <div className="overflow-hidden rounded-xl border bg-background shadow-lg">
        {/* Browser toolbar */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400" />
            <div className="size-2.5 rounded-full bg-yellow-400" />
            <div className="size-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-center">
            <motion.span
              key={slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground truncate block"
            >
              kakamalem.com/store/{slug}
            </motion.span>
          </div>
        </div>

        {/* Store header preview */}
        <div className="border-b p-4">
          <StoreHeaderPreview
            name={name}
            logoUrl={logoUrl}
            headerDisplay={headerDisplay}
          />
          {tagline && (
            <motion.p
              key={tagline}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground mt-1 text-center"
            >
              {tagline}
            </motion.p>
          )}
        </div>

        {/* Mini product grid placeholder */}
        <div className="p-4">
          <ProductGridPlaceholder />
        </div>

        {/* Store mode badge */}
        <div className="border-t px-4 py-2 bg-muted/30">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ModeIcon className="size-3.5" />
            <span>{storeModeLabels[storeMode]}</span>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center mt-3">
        Live preview of your store
      </p>
    </motion.div>
  );
}

function StoreHeaderPreview({
  name,
  logoUrl,
  headerDisplay,
}: {
  name: string;
  logoUrl: string | null;
  headerDisplay: "logo_only" | "name_only" | "logo_and_name";
}) {
  const displayName = name || "Your Store Name";
  const showLogo = logoUrl && headerDisplay !== "name_only";
  const showName = headerDisplay !== "logo_only";

  return (
    <div className="flex items-center justify-center gap-2">
      {showLogo && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative size-8 rounded overflow-hidden bg-muted"
        >
          <Image
            src={logoUrl}
            alt="Logo preview"
            fill
            className="object-contain"
            unoptimized
          />
        </motion.div>
      )}
      {showName && (
        <motion.span
          key={displayName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-semibold truncate max-w-37.5"
        >
          {displayName}
        </motion.span>
      )}
      {!showLogo && !showName && (
        <span className="text-muted-foreground text-sm">No header preview</span>
      )}
    </div>
  );
}

function ProductGridPlaceholder() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="space-y-1.5"
        >
          <div className="aspect-square rounded bg-muted animate-pulse" />
          <div className="h-2 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
        </motion.div>
      ))}
    </div>
  );
}
