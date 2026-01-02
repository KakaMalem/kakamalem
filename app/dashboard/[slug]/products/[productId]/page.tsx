import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductById, getTenantCategories } from "@/lib/db/queries/products";
import { getTenantVariantOptions } from "@/lib/db/queries/variants";
import { ProductForm } from "@/components/dashboard/products/product-form";
import { ProductVariantsSection } from "@/components/dashboard/products/product-variants-section";
import { Button } from "@/components/ui/button";

interface EditProductPageProps {
  params: Promise<{ slug: string; productId: string }>;
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { slug, productId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const [product, categories, variantOptions] = await Promise.all([
    getProductById(store.id, productId),
    getTenantCategories(store.id),
    getTenantVariantOptions(store.id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${slug}/products`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-muted-foreground">Update {product.name}</p>
        </div>
      </div>

      {/* Form */}
      <ProductForm
        tenantId={store.id}
        storeSlug={slug}
        categories={categories}
        currency={store.currency}
        product={product}
      />

      {/* Variants Section - Only for existing products */}
      <ProductVariantsSection
        tenantId={store.id}
        productId={product.id}
        currency={store.currency}
        basePrice={product.price}
        variantOptions={variantOptions}
        variants={product.variants || []}
      />
    </div>
  );
}
