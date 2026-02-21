"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, X, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from "use-debounce";
import {
  searchProductsAction,
  resolveProductsByIdsAction,
} from "@/lib/actions/page-builder";
import { useEditorContext } from "@/lib/page-builder/editor-context";
import type { ResolvedProduct } from "@/lib/page-builder/types";

// ============================================================================
// SINGLE PRODUCT PICKER (for ProductSpotlight)
// ============================================================================

interface SingleProductPickerProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function SingleProductPickerRender({
  value,
  onChange,
  readOnly,
}: SingleProductPickerProps) {
  const { tenantId } = useEditorContext();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<ResolvedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [selectedProduct, setSelectedProduct] =
    useState<ResolvedProduct | null>(null);

  // Reset search state when query changes (render-time derived state)
  const [prevQuery, setPrevQuery] = useState(debouncedQuery);
  if (prevQuery !== debouncedQuery) {
    setPrevQuery(debouncedQuery);
    setIsSearching(true);
  }

  // Search products
  useEffect(() => {
    let cancelled = false;
    searchProductsAction(tenantId, debouncedQuery).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setResults(res.data);
      setIsSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, debouncedQuery]);

  // Resolve selected product by ID
  useEffect(() => {
    if (value && !selectedProduct) {
      resolveProductsByIdsAction(tenantId, [value]).then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          setSelectedProduct(res.data[0]);
        }
      });
    }
  }, [value, tenantId, selectedProduct]);

  if (value && selectedProduct) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-2">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
          {selectedProduct.imageUrl ? (
            <Image
              src={selectedProduct.imageUrl}
              alt={selectedProduct.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="flex-1 truncate text-sm">{selectedProduct.name}</span>
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setSelectedProduct(null);
            }}
            className="h-6 w-6 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={readOnly}
          className="h-8 pl-7 text-xs"
        />
      </div>
      <ScrollArea className="h-50 rounded-md border">
        <div className="p-1">
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                onChange(product.id);
                setSelectedProduct(product);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              <span className="flex-1 truncate">{product.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {product.price}
              </span>
            </button>
          ))}
          {results.length === 0 && !isSearching && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No products found
            </p>
          )}
          {isSearching && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Searching...
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MULTI PRODUCT PICKER (for ProductGrid manual mode)
// ============================================================================

interface MultiProductPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  readOnly?: boolean;
}

export function MultiProductPickerRender({
  value = [],
  onChange,
  readOnly,
}: MultiProductPickerProps) {
  const { tenantId } = useEditorContext();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 300);
  const [results, setResults] = useState<ResolvedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<ResolvedProduct[]>(
    []
  );

  // Reset search state when query changes (render-time derived state)
  const [prevMultiQuery, setPrevMultiQuery] = useState(debouncedQuery);
  if (prevMultiQuery !== debouncedQuery) {
    setPrevMultiQuery(debouncedQuery);
    setIsSearching(true);
  }

  // Search products
  useEffect(() => {
    let cancelled = false;
    searchProductsAction(tenantId, debouncedQuery).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setResults(res.data);
      setIsSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, debouncedQuery]);

  // Resolve selected product names on mount
  useEffect(() => {
    if (value.length > 0 && selectedProducts.length === 0) {
      resolveProductsByIdsAction(tenantId, value).then((res) => {
        if (res.success && res.data) {
          setSelectedProducts(res.data);
        }
      });
    }
  }, [value, tenantId, selectedProducts.length]);

  const addProduct = useCallback(
    (product: ResolvedProduct) => {
      if (!value.includes(product.id)) {
        onChange([...value, product.id]);
        setSelectedProducts((prev) => [...prev, product]);
      }
    },
    [value, onChange]
  );

  const removeProduct = useCallback(
    (productId: string) => {
      onChange(value.filter((id) => id !== productId));
      setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
    },
    [value, onChange]
  );

  return (
    <div className="space-y-2">
      {/* Selected products */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="max-w-30 truncate">{product.name}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={readOnly}
          className="h-8 pl-7 text-xs"
        />
      </div>
      <ScrollArea className="h-40 rounded-md border">
        <div className="p-1">
          {results
            .filter((p) => !value.includes(p.id))
            .map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="flex-1 truncate">{product.name}</span>
              </button>
            ))}
          {results.length === 0 && !isSearching && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No products found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
