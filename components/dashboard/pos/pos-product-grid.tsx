"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Search,
  Package,
  Loader2,
  Grid3X3,
  List,
  Camera,
  Barcode,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatPrice } from "@/lib/utils";
import { searchProductsForSale } from "@/lib/actions/offline-sales";
import { BarcodeScanner } from "./barcode-scanner";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import {
  usePOSProductsStore,
  type POSProduct,
} from "@/lib/stores/use-pos-products-store";

// Re-export for backward compatibility
type SearchProduct = POSProduct;

type Category = {
  id: string;
  name: string;
  image: string | null;
};

interface POSProductGridProps {
  tenantId: string;
  currency: string;
  categories: Category[];
  onProductSelect: (
    product: SearchProduct,
    variant?: SearchProduct["variants"][0]
  ) => void;
  scannerMode: "camera" | "usb";
}

export function POSProductGrid({
  tenantId,
  currency,
  categories,
  onProductSelect,
  scannerMode,
}: POSProductGridProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use Zustand store for products state
  const {
    products,
    isLoading,
    selectedCategory,
    searchQuery,
    setProducts,
    setIsLoading,
    setSelectedCategory,
    setSearchQuery,
  } = usePOSProductsStore();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [variantDialogProduct, setVariantDialogProduct] =
    useState<SearchProduct | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(
    null
  );

  // Global USB barcode scanner listener
  useBarcodeScanner({
    onScan: (barcode) => {
      // Show visual feedback
      setLastScannedBarcode(barcode);
      setTimeout(() => setLastScannedBarcode(null), 1500);

      // Process the scan
      handleBarcodeScan(barcode);
    },
    enabled: scannerMode === "usb",
    minLength: 4,
    maxTimeBetweenKeys: 50,
  });

  const loadProducts = useCallback(
    async (query: string, categoryId: string | null) => {
      setIsLoading(true);
      // Pass search query and category filter to the search function
      const result = await searchProductsForSale(
        tenantId,
        query || "",
        categoryId
      );

      if (result.success && result.products) {
        setProducts(result.products);
      } else {
        setProducts([]);
      }
      setIsLoading(false);
    },
    [tenantId, setIsLoading, setProducts]
  );

  // Load products on mount
  useEffect(() => {
    loadProducts("", null);
  }, [loadProducts]);

  // Handle category selection - directly load products for that category
  const handleCategorySelect = useCallback(
    async (categoryId: string | null) => {
      setSearchQuery("");
      setSelectedCategory(categoryId);
      // Directly load products for the selected category
      await loadProducts("", categoryId);
    },
    [loadProducts, setSearchQuery, setSelectedCategory]
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.length >= 2 || query.length === 0) {
        await loadProducts(query, selectedCategory);
      }
    },
    [loadProducts, selectedCategory, setSearchQuery]
  );

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== "INPUT" &&
          activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleProductClick = (product: SearchProduct) => {
    if (product.hasVariants && product.variants.length > 0) {
      setVariantDialogProduct(product);
    } else {
      const isOutOfStock = product.trackInventory && product.stock <= 0;
      if (!isOutOfStock) {
        onProductSelect(product);
      }
    }
  };

  const handleVariantSelect = (variant: SearchProduct["variants"][0]) => {
    if (variantDialogProduct) {
      const isOutOfStock =
        variantDialogProduct.trackInventory && variant.stock <= 0;
      if (!isOutOfStock) {
        onProductSelect(variantDialogProduct, variant);
        setVariantDialogProduct(null);
      }
    }
  };

  // Handle barcode scan - search for product by barcode and add to cart
  // Note: Barcode scans ignore category filter - barcodes are unique identifiers
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      setSearchQuery(barcode);
      setIsLoading(true);

      const result = await searchProductsForSale(tenantId, barcode, null);

      if (result.success && result.products && result.products.length > 0) {
        const product = result.products[0];

        // If exact barcode match on a variant, add that variant
        if (product.hasVariants && product.variants.length > 0) {
          const matchedVariant = product.variants.find(
            (v) => v.barcode === barcode
          );
          if (matchedVariant) {
            const isOutOfStock =
              product.trackInventory && matchedVariant.stock <= 0;
            if (isOutOfStock) {
              toast.error(
                `${product.name} (${matchedVariant.displayName}) is out of stock`
              );
            } else {
              onProductSelect(product, matchedVariant);
              toast.success(
                `Added ${product.name} - ${matchedVariant.displayName}`
              );
            }
          } else {
            // Show variant selection dialog
            setVariantDialogProduct(product);
            toast.info(`Select variant for ${product.name}`);
          }
        } else {
          // Simple product - add directly
          const isOutOfStock = product.trackInventory && product.stock <= 0;
          if (isOutOfStock) {
            toast.error(`${product.name} is out of stock`);
          } else {
            onProductSelect(product);
            toast.success(`Added ${product.name}`);
          }
        }

        setProducts(result.products);
      } else {
        setProducts([]);
        toast.error(`No product found for barcode: ${barcode}`);
      }

      setIsLoading(false);
    },
    [tenantId, onProductSelect, setSearchQuery, setIsLoading, setProducts]
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Search bar */}
      <div className="shrink-0 border-b p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search products or scan barcode..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          {scannerMode === "camera" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => setScannerOpen(true)}
            >
              <Camera className="size-5" />
            </Button>
          )}
          {scannerMode === "usb" && (
            <div
              className={cn(
                "flex h-12 items-center gap-2 rounded-md border px-3 transition-all",
                lastScannedBarcode
                  ? "border-green-500 bg-green-500/10 text-green-600"
                  : "border-muted bg-muted/50 text-muted-foreground"
              )}
            >
              <Barcode className="size-5" />
              <span className="text-xs font-medium hidden sm:inline">
                {lastScannedBarcode ? "Scanned!" : "Scanner Ready"}
              </span>
            </div>
          )}
        </div>

        {/* USB Scanner visual feedback overlay */}
        {lastScannedBarcode && scannerMode === "usb" && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-600 animate-in fade-in slide-in-from-top-2 duration-200">
            <Barcode className="size-4" />
            <span className="font-mono">{lastScannedBarcode}</span>
          </div>
        )}
      </div>

      {/* Category tabs + view toggle */}
      <div className="shrink-0 flex items-center gap-2 border-b px-3 py-2">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => handleCategorySelect(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                className="h-9 shrink-0"
                onClick={() => handleCategorySelect(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 border-l pl-2">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            className="size-9"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="size-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="size-9"
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Product grid */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
            <Package className="mb-3 size-12 opacity-40" />
            <p className="font-medium">No products found</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 p-3 pb-24 lg:pb-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const isOutOfStock = product.trackInventory && product.stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all",
                    isOutOfStock
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-primary hover:shadow-md active:scale-[0.98]"
                  )}
                  onClick={() => handleProductClick(product)}
                  disabled={isOutOfStock}
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-muted">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Package className="size-10 text-muted-foreground/40" />
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <Badge variant="destructive">Out of stock</Badge>
                      </div>
                    )}
                    {product.hasVariants && !isOutOfStock && (
                      <Badge
                        variant="secondary"
                        className="absolute right-2 top-2"
                      >
                        {product.variants.length} options
                      </Badge>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-tight">
                      {product.name}
                    </p>
                    <p className="mt-auto pt-2 text-base font-bold text-primary">
                      {formatPrice(parseFloat(product.price), currency)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="divide-y pb-24 lg:pb-0">
            {products.map((product) => {
              const isOutOfStock = product.trackInventory && product.stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-4 p-4 text-left transition-colors",
                    isOutOfStock
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted active:bg-muted/80"
                  )}
                  onClick={() => handleProductClick(product)}
                  disabled={isOutOfStock}
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={64}
                        height={64}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Package className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product.name}</p>
                    {product.hasVariants && (
                      <p className="text-sm text-muted-foreground">
                        {product.variants.length} variants
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {formatPrice(parseFloat(product.price), currency)}
                    </p>
                    {product.trackInventory && (
                      <p
                        className={cn(
                          "text-sm",
                          isOutOfStock
                            ? "text-destructive font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {isOutOfStock
                          ? "Out of stock"
                          : `${product.stock} left`}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Variant selection dialog */}
      <Dialog
        open={!!variantDialogProduct}
        onOpenChange={(open) => !open && setVariantDialogProduct(null)}
      >
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{variantDialogProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="grid gap-2">
              {variantDialogProduct?.variants.map((variant) => {
                const isOutOfStock =
                  variantDialogProduct.trackInventory && variant.stock <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                      isOutOfStock
                        ? "cursor-not-allowed opacity-50"
                        : "hover:border-primary hover:bg-muted active:bg-muted/80"
                    )}
                    onClick={() => handleVariantSelect(variant)}
                    disabled={isOutOfStock}
                  >
                    <div>
                      <p className="font-medium">{variant.displayName}</p>
                      {variant.sku && (
                        <p className="text-xs text-muted-foreground">
                          SKU: {variant.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {formatPrice(
                          parseFloat(
                            variant.price || variantDialogProduct.price
                          ),
                          currency
                        )}
                      </p>
                      {variantDialogProduct.trackInventory && (
                        <p
                          className={cn(
                            "text-xs",
                            isOutOfStock
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          )}
                        >
                          {isOutOfStock
                            ? "Out of stock"
                            : `${variant.stock} left`}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera barcode scanner */}
      {scannerMode === "camera" && (
        <BarcodeScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onScan={handleBarcodeScan}
        />
      )}
    </div>
  );
}
