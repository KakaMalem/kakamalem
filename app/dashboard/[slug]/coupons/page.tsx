import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getCouponsWithStats } from "@/lib/db/queries/coupons";
import { CouponsList } from "@/components/dashboard/coupons/coupons-list";
import { Button } from "@/components/ui/button";

interface CouponsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CouponsPage({ params }: CouponsPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const coupons = await getCouponsWithStats(store.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promo Codes</h1>
          <p className="text-muted-foreground">
            Create discount codes to attract customers and boost sales.
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${slug}/coupons/new`}>
            <Plus className="size-4" />
            Create Code
          </Link>
        </Button>
      </div>

      {/* Coupons List */}
      <CouponsList
        tenantId={store.id}
        storeSlug={slug}
        coupons={coupons}
        currency={store.currency}
      />
    </div>
  );
}
