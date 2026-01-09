import { notFound } from "next/navigation";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getWishlistItems } from "@/lib/db/queries/wishlists";
import { WishlistItemCard } from "@/components/store/account/wishlist-item-card";

interface WishlistPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WishlistPage({ params }: WishlistPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const user = await getUser();

  // Shouldn't happen due to layout protection, but just in case
  if (!user) {
    return null;
  }

  const items = await getWishlistItems(store.id, user.id);

  // Filter to only show available products (active status)
  const availableItems = items.filter(
    (item) => item.product.status === "active"
  );
  const unavailableItems = items.filter(
    (item) => item.product.status !== "active"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5" />
          Wishlist
          {items.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({items.length} {items.length === 1 ? "item" : "items"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Heart className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Your wishlist is empty</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Save items you love by clicking the heart icon on products.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/store/${slug}/products`}>
                <ShoppingBag className="mr-2 size-4" />
                Browse Products
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Available Items */}
            {availableItems.length > 0 && (
              <div className="space-y-4">
                {availableItems.map((item) => (
                  <WishlistItemCard
                    key={item.id}
                    item={item}
                    storeSlug={slug}
                    currency={store.currency}
                  />
                ))}
              </div>
            )}

            {/* Unavailable Items */}
            {unavailableItems.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  No longer available ({unavailableItems.length})
                </h3>
                {unavailableItems.map((item) => (
                  <WishlistItemCard
                    key={item.id}
                    item={item}
                    storeSlug={slug}
                    currency={store.currency}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
