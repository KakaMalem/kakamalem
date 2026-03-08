import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getProductById, getTenantCategories } from "@/lib/db/queries/products";
import { getProductVariantOptionTypes } from "@/lib/db/queries/variants";
import { getProductPriceTiers } from "@/lib/db/queries/pricing";
import { ProductForm } from "@/components/dashboard/products/product-form";
import { ProductSourceBadge } from "@/components/dashboard/products/product-source-badge";
import { Button } from "@/components/ui/button";
import {
  transformDbOptionsToInlineOptions,
  transformDbVariantsToGeneratedVariants,
} from "@/lib/validations/variant-form";
import type { OptionValueImageAssignment } from "@/lib/actions/variants";

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

  const [product, categories, productOptionTypes, priceTiers] =
    await Promise.all([
      getProductById(store.id, productId),
      getTenantCategories(store.id),
      getProductVariantOptionTypes(store.id, productId),
      getProductPriceTiers(productId),
    ]);

  if (!product) {
    notFound();
  }

  // Transform product's current variant options and variants for the form
  const initialVariantOptions = product.hasVariants
    ? transformDbOptionsToInlineOptions(productOptionTypes)
    : [];

  const initialVariants =
    product.hasVariants && product.variants
      ? transformDbVariantsToGeneratedVariants(product.variants)
      : [];

  // Transform option value images to the format expected by the form
  const initialImageAssignments: OptionValueImageAssignment[] = [];
  if (product.optionValueImages && product.optionValueImages.length > 0) {
    // Group by option value
    const grouped = new Map<
      string,
      {
        optionId: string;
        optionName: string;
        valueId: string;
        value: string;
        imageIds: string[];
      }
    >();

    for (const ovi of product.optionValueImages) {
      if (!ovi.optionValue) continue;

      const key = ovi.optionValueId;
      const existing = grouped.get(key);

      if (existing) {
        existing.imageIds.push(ovi.mediaId);
      } else {
        grouped.set(key, {
          optionId: ovi.optionValue.optionId,
          optionName: ovi.optionValue.option?.name || "",
          valueId: ovi.optionValueId,
          value: ovi.optionValue.value,
          imageIds: [ovi.mediaId],
        });
      }
    }

    initialImageAssignments.push(...grouped.values());
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${slug}/products`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Edit Product</h1>
            <ProductSourceBadge
              sourceType={
                product.sourceType as
                  | "aliexpress"
                  | "amazon"
                  | "autods"
                  | "manual"
              }
              sourceId={product.sourceId}
              sourceUrl={product.sourceUrl}
              lastSyncedAt={product.sourceLastSyncedAt}
              syncEnabled={product.sourceSyncEnabled}
              productId={productId}
              tenantId={store.id}
            />
          </div>
          <p className="text-muted-foreground truncate">
            Update {product.name}
          </p>
        </div>
      </div>

      {/* Form with integrated variant management */}
      <ProductForm
        tenantId={store.id}
        storeSlug={slug}
        categories={categories}
        currency={store.currency}
        product={product}
        initialVariantOptions={initialVariantOptions}
        initialVariants={initialVariants}
        initialPriceTiers={priceTiers}
        initialImageAssignments={initialImageAssignments}
        posScannerMode={store.posScannerMode as "camera" | "usb"}
      />
    </div>
  );
}
