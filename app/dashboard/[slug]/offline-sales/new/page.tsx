import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { Button } from "@/components/ui/button";
import { RecordSaleForm } from "@/components/dashboard/offline-sales/record-sale-form";

interface NewOfflineSalePageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewOfflineSalePage({
  params,
}: NewOfflineSalePageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/${slug}/offline-sales`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Sale</h1>
      </div>

      {/* Form */}
      <RecordSaleForm
        storeSlug={slug}
        tenantId={store.id}
        currency={store.currency}
        phoneOrdersEnabled={store.phoneOrdersEnabled}
      />
    </div>
  );
}
