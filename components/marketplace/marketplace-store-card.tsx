import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Package,
  Star,
  Store,
  BadgeCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { MarketplaceStore } from "@/lib/db/queries/marketplace";

interface MarketplaceStoreCardProps {
  store: MarketplaceStore;
  className?: string;
}

export function MarketplaceStoreCard({
  store,
  className,
}: MarketplaceStoreCardProps) {
  return (
    <Link
      href={`/marketplace/stores/${store.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-background",
        "shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20",
        className
      )}
    >
      {/* Cover image + logo */}
      <div className="relative">
        <div className="aspect-video overflow-hidden bg-muted/30">
          {store.coverImage ? (
            <Image
              src={store.coverImage}
              alt={store.name}
              fill
              quality={90}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-muted/50 to-muted">
              <Store className="size-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Top-left badges */}
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {store.isNew && (
              <span className="flex items-center gap-0.5 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                <Sparkles className="size-2.5" />
                New
              </span>
            )}
          </div>

          {/* Top-right badges */}
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {store.isVerified && (
              <span className="flex items-center rounded-md bg-blue-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
                <BadgeCheck className="mr-0.5 size-3" />
                Verified
              </span>
            )}
            {store.isPro && !store.isVerified && (
              <span className="rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm">
                Pro
              </span>
            )}
          </div>
        </div>

        {/* Profile image overlay - outside overflow-hidden container */}
        <div className="absolute -bottom-5 left-3 z-10">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg border-2 border-background bg-background shadow-sm">
            {store.profileImage ? (
              <Image
                src={store.profileImage}
                alt={store.name}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <Store className="size-5 text-muted-foreground/50" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-3 pb-3 pt-7">
        {/* Name + tagline */}
        <h3 className="truncate text-sm font-semibold group-hover:text-primary">
          {store.name}
        </h3>
        {store.tagline && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {store.tagline}
          </p>
        )}

        {/* Category badges */}
        {store.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {store.categories.slice(0, 2).map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {cat.icon && <span className="mr-0.5">{cat.icon}</span>}
                {cat.name}
              </span>
            ))}
            {store.categories.length > 2 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                +{store.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="min-h-2 flex-1" />

        {/* Stats row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {store.rating !== null && (
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground">
                {store.rating.toFixed(1)}
              </span>
              <span>({store.reviewCount})</span>
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Package className="size-3" />
            {store.productCount}
          </span>
          {store.storeLocationCity && (
            <span className="flex items-center gap-0.5">
              <MapPin className="size-3" />
              <span className="truncate">{store.storeLocationCity}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
