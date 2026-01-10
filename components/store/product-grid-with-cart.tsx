"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductCard } from "./product-card";
import { addToCartAction } from "@/lib/cart/actions";
import { cartActions } from "@/lib/stores/use-cart-store";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice?: string | null;
  stock: number;
  hasVariants: boolean;
  trackInventory: boolean;
  showStock: boolean;
  status: "draft" | "active" | "archived";
  image: { url: string; altText: string | null } | null;
  rating?: number;
  reviewCount?: number;
  isNew?: boolean;
}

interface ProductGridWithCartProps {
  products: Product[];
  storeSlug: string;
  tenantId: string;
  currency: string;
}

export function ProductGridWithCart({
  products,
  storeSlug,
  tenantId,
  currency,
}: ProductGridWithCartProps) {
  const router = useRouter();

  const handleAddToCart = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // If product has variants, navigate to product page to select variant
    if (product.hasVariants) {
      router.push(`/store/${storeSlug}/product/${product.slug}`);
      return;
    }

    try {
      const result = await addToCartAction(
        tenantId,
        storeSlug,
        productId,
        1,
        null
      );

      if (result.success) {
        // Update local cart state
        cartActions.setCart(result.cart, storeSlug);
        toast.success("Added to cart", {
          description: product.name,
        });
        // Open cart drawer
        cartActions.setIsOpen(true);
      } else {
        toast.error("Failed to add to cart", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Failed to add to cart", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          storeSlug={storeSlug}
          currency={currency}
          onAddToCart={handleAddToCart}
        />
      ))}
    </div>
  );
}
