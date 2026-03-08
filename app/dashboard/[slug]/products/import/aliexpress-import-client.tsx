"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Package, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { AliExpressProductPreview } from "@/components/dashboard/products/aliexpress-product-preview";
import {
  scrapeAliExpressProductAction,
  importAliExpressProductAction,
} from "@/lib/actions/aliexpress-import";
import type { AliExpressProduct } from "@/lib/aliexpress/types";

interface AliExpressImportClientProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  categories: { id: string; name: string }[];
}

export function AliExpressImportClient({
  tenantId,
  storeSlug,
  currency,
  categories,
}: AliExpressImportClientProps) {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [product, setProduct] = useState<AliExpressProduct | null>(null);

  // Override fields
  const [nameOverride, setNameOverride] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"draft" | "active">(
    "draft"
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScraping(true);
    setScrapeError(null);
    setProduct(null);

    try {
      const result = await scrapeAliExpressProductAction(url.trim());

      if (!result.success || !result.product) {
        setScrapeError(
          result.error || "Failed to extract product data from AliExpress"
        );
        return;
      }

      setProduct(result.product);
      setNameOverride(result.product.title);

      // Use converted price (AFN) if available, otherwise fall back to original
      if (result.convertedPrice !== undefined) {
        setPriceOverride(result.convertedPrice.toString());
      } else if (result.product.price !== null) {
        setPriceOverride(result.product.price.toString());
      } else {
        setPriceOverride("");
      }
    } catch {
      setScrapeError("An unexpected error occurred. Please try again.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleImport = async () => {
    if (!product) return;

    setIsImporting(true);

    try {
      const result = await importAliExpressProductAction(tenantId, product, {
        name: nameOverride || undefined,
        price: priceOverride || undefined,
        status: selectedStatus,
        categoryIds: selectedCategoryId ? [selectedCategoryId] : undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to import product");
        return;
      }

      // Show warnings if any
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          toast.warning(warning);
        }
      }

      toast.success("Product imported successfully!");

      // Redirect to the product edit page
      if (result.productSlug) {
        router.push(`/dashboard/${storeSlug}/products/${result.productId}`);
      } else {
        router.push(`/dashboard/${storeSlug}/products`);
      }
    } catch {
      toast.error("An unexpected error occurred during import");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AliExpress Product URL</CardTitle>
          <CardDescription>
            Paste the full URL of an AliExpress product page to import its
            details, images, and variants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScrape} className="flex gap-3">
            <Input
              placeholder="https://www.aliexpress.com/item/1005007123456789.html"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isScraping}
              className="flex-1"
            />
            <Button type="submit" disabled={isScraping || !url.trim()}>
              {isScraping ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Fetch Product
                </>
              )}
            </Button>
          </form>

          {scrapeError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="size-4" />
              <AlertDescription>{scrapeError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Product Preview */}
      {product && (
        <>
          <AliExpressProductPreview product={product} />

          {/* Import Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Settings</CardTitle>
              <CardDescription>
                Customize the product details before importing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name Override */}
              <div className="space-y-2">
                <Label htmlFor="ali-name">Product Name</Label>
                <Input
                  id="ali-name"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  placeholder="Product name"
                />
              </div>

              {/* Price Override */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ali-price">Price ({currency})</Label>
                  <Input
                    id="ali-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder="0.00"
                  />
                  {product.price !== null && (
                    <p className="text-xs text-muted-foreground">
                      Original: {product.currency} {product.price.toFixed(2)}
                      {product.currency !== currency &&
                        " (auto-converted to " + currency + ")"}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(v) =>
                      setSelectedStatus(v as "draft" | "active")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                {categories.length > 0 && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={selectedCategoryId}
                      onValueChange={setSelectedCategoryId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Import Button */}
              <div className="flex items-center gap-3 pt-4 border-t">
                <Button onClick={handleImport} disabled={isImporting} size="lg">
                  {isImporting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing... (downloading images)
                    </>
                  ) : (
                    <>
                      <Package className="size-4" />
                      Import Product
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {product.images.length} image
                  {product.images.length !== 1 ? "s" : ""} will be downloaded
                  {product.variantOptions.length > 0 &&
                    ` and ${product.variants.length || "multiple"} variant${product.variants.length !== 1 ? "s" : ""} will be created`}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
