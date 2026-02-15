import { notFound } from "next/navigation";
import Link from "next/link";
import { Package, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/server";
import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import {
  getCustomerOrders,
  getCustomerOrderCount,
} from "@/lib/db/queries/orders";
import { OrderCard } from "@/components/store/account/order-card";

interface OrdersPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const ORDERS_PER_PAGE = 10;

export default async function OrdersPage({
  params,
  searchParams,
}: OrdersPageProps) {
  const { slug } = await params;
  const { page } = await searchParams;

  const store = await resolveTenant(slug);
  if (!store) {
    notFound();
  }

  const user = await getUser();

  // Shouldn't happen due to layout protection, but just in case
  if (!user) {
    return null;
  }

  const basePath = await getStoreBasePath(store.slug);

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const offset = (currentPage - 1) * ORDERS_PER_PAGE;

  const [orders, totalCount] = await Promise.all([
    getCustomerOrders(store.id, user.id, {
      limit: ORDERS_PER_PAGE,
      offset,
    }),
    getCustomerOrderCount(store.id, user.id),
  ]);

  const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-5" />
          Order History
          {totalCount > 0 && (
            <span className="text-muted-foreground font-normal">
              ({totalCount} {totalCount === 1 ? "order" : "orders"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No orders yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              When you place orders at {store.name}, they&apos;ll appear here.
            </p>
            <Button asChild className="mt-4">
              <Link href={`${basePath}/products`}>
                <ShoppingBag className="mr-2 size-4" />
                Start Shopping
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order List */}
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  storeSlug={slug}
                  currency={store.currency}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`${basePath}/account/orders?page=${
                        currentPage - 1
                      }`}
                    >
                      Previous
                    </Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`${basePath}/account/orders?page=${
                        currentPage + 1
                      }`}
                    >
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
