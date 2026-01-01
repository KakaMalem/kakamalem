import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopProduct } from "@/lib/db/queries/analytics";

interface TopProductsProps {
  products: TopProduct[];
  currency: string;
  storeSlug: string;
}

export function TopProducts({
  products,
  currency,
  storeSlug,
}: TopProductsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Top Products</CardTitle>
        <Link
          href={`/dashboard/${storeSlug}/products`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No sales data yet. Top sellers will appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.quantitySold} sold
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium">
                  {product.revenue.toLocaleString()} {currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
