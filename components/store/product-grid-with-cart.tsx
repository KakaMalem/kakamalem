"use client";

import { useRouter } from "next/navigation";

import { ProductCard } from "./product-card";
import { useCart } from "@/lib/hooks/use-cart";
import type { CartItemProduct } from "@/lib/types/cart";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice?: string | null;
  stock: number;
  hasVariants: boolean;
  trackInventory: boolean;
  allowBackorder?: boolean;
  showStock: boolean;
  status: "draft" | "active" | "archived";
  image: { url: string; altText: string | null } | null;
  minVariantPrice?: string;
  maxVariantPrice?: string;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
}

interface ProductGridWithCartProps {
  products: Product[];
  storeSlug: string;
  tenantId: string;
  currency: string;
  /** When true, hides add-to-cart buttons (catalog/showcase mode) */
  catalogMode?: boolean;
}

export function ProductGridWithCart({
  products,
  storeSlug,
  tenantId,
  currency,
  catalogMode = false,
}: ProductGridWithCartProps) {
  const router = useRouter();
  const { addToCart, isAddingProduct } = useCart();

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // If product has variants, navigate to product page to select variant
    if (product.hasVariants) {
      router.push(`/store/${storeSlug}/product/${product.slug}`);
      return;
    }

    // Build optimistic product data for immediate UI update
    const optimisticProduct: CartItemProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      trackInventory: product.trackInventory,
      allowBackorder: product.allowBackorder ?? false,
      status: product.status,
      hasVariants: product.hasVariants,
      image: product.image,
      priceTiers: [],
    };

    addToCart(productId, 1, null, optimisticProduct, null);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          tenantId={tenantId}
          storeSlug={storeSlug}
          currency={currency}
          onAddToCart={catalogMode ? undefined : handleAddToCart}
          catalogMode={catalogMode}
          isAddingToCart={isAddingProduct(product.id)}
        />
      ))}
    </div>
  );
}
