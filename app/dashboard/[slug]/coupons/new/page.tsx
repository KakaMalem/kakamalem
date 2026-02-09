import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProducts } from "@/lib/db/queries/products";
import { CouponForm } from "@/components/dashboard/coupons/coupon-form";
import { Button } from "@/components/ui/button";

interface NewCouponPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewCouponPage({ params }: NewCouponPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  // Fetch products for the selector
  const productsData = await getProducts(store.id, { limit: 1000 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/dashboard/${slug}/coupons`}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back to promo codes</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create Promo Code
          </h1>
          <p className="text-muted-foreground">
            Create a new discount code for your customers.
          </p>
        </div>
      </div>

      {/* Form */}
      <CouponForm
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        products={productsData.products.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    </div>
  );
}
