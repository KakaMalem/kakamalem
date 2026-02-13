import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantCategories } from "@/lib/db/queries/products";
import { Button } from "@/components/ui/button";
import { AmazonImportClient } from "./amazon-import-client";

interface ImportPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ImportPage({ params }: ImportPageProps) {
  const { slug } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const categories = await getTenantCategories(store.id);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${slug}/products`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Import from Amazon
          </h1>
          <p className="text-muted-foreground">
            Paste an Amazon product URL to import product details, images, and
            variants.
          </p>
        </div>
      </div>

      {/* Import Form */}
      <AmazonImportClient
        tenantId={store.id}
        storeSlug={slug}
        currency={store.currency}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
