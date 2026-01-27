import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantCategories } from "@/lib/db/queries/products";
import { ProductForm } from "@/components/dashboard/products/product-form";
import { Button } from "@/components/ui/button";

interface NewProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewProductPage({ params }: NewProductPageProps) {
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
          <h1 className="text-2xl font-bold tracking-tight">Add Product</h1>
          <p className="text-muted-foreground">
            Create a new product for your store.
          </p>
        </div>
      </div>

      {/* Form */}
      <ProductForm
        tenantId={store.id}
        storeSlug={slug}
        categories={categories}
        currency={store.currency}
        posScannerMode={store.posScannerMode as "camera" | "usb"}
      />
    </div>
  );
}
