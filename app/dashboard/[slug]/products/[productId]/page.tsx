import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductById, getTenantCategories } from "@/lib/db/queries/products";
import {
  getTenantVariantOptions,
  getProductVariantOptionTypes,
} from "@/lib/db/queries/variants";
import { ProductForm } from "@/components/dashboard/products/product-form";
import { Button } from "@/components/ui/button";
import {
  transformDbOptionsToInlineOptions,
  transformDbVariantsToGeneratedVariants,
} from "@/lib/validations/variant-form";

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

  const [product, categories, tenantVariantOptions, productOptionTypes] =
    await Promise.all([
      getProductById(store.id, productId),
      getTenantCategories(store.id),
      getTenantVariantOptions(store.id),
      getProductVariantOptionTypes(store.id, productId),
    ]);

  if (!product) {
    notFound();
  }

  // Transform existing variant options for autocomplete suggestions
  const existingVariantOptions = tenantVariantOptions.map((opt) => ({
    id: opt.id,
    name: opt.name,
    values: opt.values.map((v) => ({ id: v.id, value: v.value })),
  }));

  // Transform product's current variant options and variants for the form
  const initialVariantOptions = product.hasVariants
    ? transformDbOptionsToInlineOptions(productOptionTypes)
    : [];

  const initialVariants =
    product.hasVariants && product.variants
      ? transformDbVariantsToGeneratedVariants(product.variants)
      : [];

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
          <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
          <p className="text-muted-foreground">Update {product.name}</p>
        </div>
      </div>

      {/* Form with integrated variant management */}
      <ProductForm
        tenantId={store.id}
        storeSlug={slug}
        categories={categories}
        currency={store.currency}
        product={product}
        existingVariantOptions={existingVariantOptions}
        initialVariantOptions={initialVariantOptions}
        initialVariants={initialVariants}
      />
    </div>
  );
}
