"use client";

import { create } from "zustand";

export type POSProduct = {
  id: string;
  name: string;
  price: string;
  stock: number;
  trackInventory: boolean;
  hasVariants: boolean;
  variants: Array<{
    id: string;
    displayName: string;
    sku: string | null;
    barcode: string | null;
    price: string | null;
    stock: number;
    image: string | null;
  }>;
  image: string | null;
};

type StockUpdate = {
  productId: string;
  variantId: string | null;
  newStock: number;
};

interface POSProductsState {
  products: POSProduct[];
  isLoading: boolean;
  selectedCategory: string | null;
  searchQuery: string;

  // Actions
  setProducts: (products: POSProduct[]) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;

  /**
   * Update stock for specific products/variants after a sale
   * This is more efficient than refetching all products
   */
  updateStock: (updates: StockUpdate[]) => void;

  /**
   * Reset the store (e.g., when switching stores)
   */
  reset: () => void;
}

const initialState = {
  products: [] as POSProduct[],
  isLoading: false,
  selectedCategory: null as string | null,
  searchQuery: "",
};

export const usePOSProductsStore = create<POSProductsState>((set) => ({
  ...initialState,

  setProducts: (products) => set({ products }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  updateStock: (updates) =>
    set((state) => {
      // Create a map for quick lookup
      const updateMap = new Map<string, number>();
      for (const update of updates) {
        const key = update.variantId
          ? `variant:${update.variantId}`
          : `product:${update.productId}`;
        updateMap.set(key, update.newStock);
      }

      // Update products immutably
      const updatedProducts = state.products.map((product) => {
        // Check if this product needs a direct stock update (non-variant)
        const productKey = `product:${product.id}`;
        const productStockUpdate = updateMap.get(productKey);

        // Check if any variants need updates
        let hasVariantUpdates = false;
        const updatedVariants = product.variants.map((variant) => {
          const variantKey = `variant:${variant.id}`;
          const variantStockUpdate = updateMap.get(variantKey);
          if (variantStockUpdate !== undefined) {
            hasVariantUpdates = true;
            return { ...variant, stock: variantStockUpdate };
          }
          return variant;
        });

        // Return updated product if any changes
        if (productStockUpdate !== undefined || hasVariantUpdates) {
          return {
            ...product,
            stock:
              productStockUpdate !== undefined
                ? productStockUpdate
                : product.stock,
            variants: hasVariantUpdates ? updatedVariants : product.variants,
          };
        }

        return product;
      });

      return { products: updatedProducts };
    }),

  reset: () => set(initialState),
}));
