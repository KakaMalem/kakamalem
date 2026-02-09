import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCouponById } from "@/lib/db/queries/coupons";
import { getProducts } from "@/lib/db/queries/products";
import { CouponForm } from "@/components/dashboard/coupons/coupon-form";
import { Button } from "@/components/ui/button";

interface EditCouponPageProps {
  params: Promise<{ slug: string; couponId: string }>;
}

export default async function EditCouponPage({ params }: EditCouponPageProps) {
  const { slug, couponId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [coupon, productsData] = await Promise.all([
    getCouponById(store.id, couponId),
    getProducts(store.id, { limit: 1000 }),
  ]);

  if (!coupon) {
    notFound();
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Edit Promo Code</h1>
          <p className="text-muted-foreground">
            Update the promo code{" "}
            <span className="font-mono font-semibold">{coupon.code}</span>
          </p>
        </div>
      </div>

      {/* Form */}
      <CouponForm
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        coupon={coupon}
        products={productsData.products.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    </div>
  );
}
