import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  MapPin,
  Package,
  Star,
  Store,
  ExternalLink,
  BadgeCheck,
  Sparkles,
  ShoppingBag,
} from "lucide-react";

import {
  getMarketplaceStoreProfile,
  getSimilarStores,
  isFollowingStore,
} from "@/lib/db/queries/marketplace";
import { getUser } from "@/lib/auth/server";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/marketplace/follow-button";

interface StoreProfilePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: StoreProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getMarketplaceStoreProfile(slug);

  if (!store) {
    return { title: "Store Not Found" };
  }

  return {
    title: `${store.name} - Marketplace | Kaka Malem`,
    description:
      store.tagline ||
      store.about?.slice(0, 160) ||
      `Visit ${store.name} on Kaka Malem marketplace.`,
    openGraph: {
      title: `${store.name} | Kaka Malem`,
      description:
        store.tagline || `Discover ${store.name} on Kaka Malem marketplace.`,
      images: store.coverImage ? [{ url: store.coverImage }] : undefined,
      type: "profile",
    },
  };
}

export default async function StoreProfilePage({
  params,
}: StoreProfilePageProps) {
  const { slug } = await params;
  const [store, user] = await Promise.all([
    getMarketplaceStoreProfile(slug),
    getUser(),
  ]);

  if (!store) {
    notFound();
  }

  const [similarStores, following] = await Promise.all([
    getSimilarStores(store.id),
    user ? isFollowingStore(user.id, store.id) : Promise.resolve(false),
  ]);

  const memberSince = new Date(store.createdAt).getFullYear();
  const priceRangeLabel = ["", "$", "$$", "$$$"][store.priceRange] || "$$";

  return (
    <div className="flex flex-col">
      {/* Cover Image */}
      <div className="relative h-48 bg-muted/50 sm:h-64 lg:h-72">
        {store.coverImage ? (
          <Image
            src={store.coverImage}
            alt={`${store.name} cover`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-muted/50 to-muted">
            <Store className="size-16 text-muted-foreground/20" />
          </div>
        )}
      </div>

      {/* Store Header */}
      <div className="border-b">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:gap-6">
            {/* Logo */}
            <div className="relative z-10 -mt-16 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-background bg-background shadow-md sm:-mt-20 sm:size-28">
              {store.logoUrl ? (
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  width={112}
                  height={112}
                  className="object-cover"
                />
              ) : (
                <Store className="size-10 text-muted-foreground/50" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{store.name}</h1>
                {store.isVerified && (
                  <BadgeCheck className="size-5 text-blue-500" />
                )}
                {store.isPro && (
                  <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    PRO
                  </span>
                )}
                {store.isNew && (
                  <span className="flex items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <Sparkles className="size-2.5" />
                    New
                  </span>
                )}
              </div>
              {store.tagline && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                  {store.tagline}
                </p>
              )}

              {/* Category badges */}
              {store.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {store.categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {cat.icon && <span className="mr-0.5">{cat.icon}</span>}
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {user && (
                <FollowButton
                  tenantId={store.id}
                  initialFollowing={following}
                />
              )}
              <Button asChild>
                <Link href={`/store/${store.slug}`} target="_blank">
                  Visit Store
                  <ExternalLink className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 border-t py-3 text-sm text-muted-foreground sm:gap-6">
            {store.rating !== null && (
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">
                  {store.rating.toFixed(1)}
                </span>
                <span>({store.reviewCount} reviews)</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="size-4" />
              {store.productCount} products
            </span>
            {store.storeLocationCity && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {store.storeLocationCity}
              </span>
            )}
            <span>{priceRangeLabel}</span>
            <span>Member since {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column: About + Featured Products */}
          <div className="space-y-8 lg:col-span-2">
            {/* About */}
            {store.about && (
              <section>
                <h2 className="text-lg font-semibold">About</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {store.about}
                </p>
              </section>
            )}

            {/* Featured Products */}
            {store.featuredProducts.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Products</h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/store/${store.slug}`} target="_blank">
                      View all
                      <ExternalLink className="ml-1 size-3" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {store.featuredProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/store/${store.slug}/product/${product.slug}`}
                      className="group overflow-hidden rounded-lg border bg-background transition-shadow hover:shadow-md"
                    >
                      <div className="relative aspect-square bg-muted/30">
                        {product.image ? (
                          <Image
                            src={product.image.url}
                            alt={product.image.alt || product.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 50vw, 200px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ShoppingBag className="size-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-xs font-medium">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-xs font-bold">
                          {formatPrice(
                            parseFloat(product.price),
                            store.currency
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Rating Breakdown */}
            {store.reviewCount > 0 && (
              <section>
                <h2 className="text-lg font-semibold">Ratings</h2>
                <div className="mt-3 flex items-start gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {store.rating?.toFixed(1)}
                    </div>
                    <div className="mt-1 flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`size-3.5 ${s <= Math.round(store.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {store.reviewCount} reviews
                    </p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((level) => {
                      const count = store.ratingDistribution[level] || 0;
                      const pct =
                        store.reviewCount > 0
                          ? (count / store.reviewCount) * 100
                          : 0;
                      return (
                        <div key={level} className="flex items-center gap-2">
                          <span className="w-3 text-xs text-muted-foreground">
                            {level}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-xs text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right column: Quick Info */}
          <div className="space-y-6">
            {/* Quick stats card */}
            <div className="rounded-xl border p-4">
              <h3 className="font-semibold">Store Info</h3>
              <dl className="mt-3 space-y-2.5 text-sm">
                {store.storeLocationCity && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">{store.storeLocationCity}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Products</dt>
                  <dd className="font-medium">{store.productCount}</dd>
                </div>
                {store.totalOrders > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Orders completed</dt>
                    <dd className="font-medium">{store.totalOrders}+</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="font-medium">{memberSince}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Price range</dt>
                  <dd className="font-medium">{priceRangeLabel}</dd>
                </div>
              </dl>
            </div>

            {/* Social links */}
            {Object.keys(store.socialLinks).length > 0 && (
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">Connect</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(store.socialLinks).map(([platform, url]) =>
                    url ? (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </a>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {store.tags.length > 0 && (
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">Tags</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {store.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <Button className="w-full" size="lg" asChild>
              <Link href={`/store/${store.slug}`} target="_blank">
                Visit Store
                <ExternalLink className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Similar Stores */}
        {Array.isArray(similarStores) && similarStores.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="text-lg font-semibold">Similar Stores</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similarStores.map(
                (s: {
                  id: string;
                  slug: string;
                  name: string;
                  tagline: string | null;
                  logoUrl: string | null;
                  storeLocationCity: string | null;
                  coverImage: string | null;
                  isVerified: boolean;
                }) => (
                  <Link
                    key={s.id}
                    href={`/marketplace/stores/${s.slug}`}
                    className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-md hover:border-primary/20"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                      {s.logoUrl ? (
                        <Image
                          src={s.logoUrl}
                          alt={s.name}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      ) : (
                        <Store className="size-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold group-hover:text-primary">
                        {s.name}
                      </h3>
                      {s.tagline && (
                        <p className="truncate text-xs text-muted-foreground">
                          {s.tagline}
                        </p>
                      )}
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {s.isVerified && (
                          <BadgeCheck className="size-3 text-blue-500" />
                        )}
                        {s.storeLocationCity && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="size-2.5" />
                            {s.storeLocationCity}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
