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

import { AmazonProductPreview } from "@/components/dashboard/products/amazon-product-preview";
import {
  scrapeAmazonProductAction,
  importAmazonProductAction,
} from "@/lib/actions/amazon-import";
import type { AmazonProduct } from "@/lib/amazon/types";

interface AmazonImportClientProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  categories: { id: string; name: string }[];
}

export function AmazonImportClient({
  tenantId,
  storeSlug,
  currency,
  categories,
}: AmazonImportClientProps) {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [product, setProduct] = useState<AmazonProduct | null>(null);

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
      const result = await scrapeAmazonProductAction(url.trim());

      if (!result.success || !result.product) {
        setScrapeError(
          result.error || "Failed to extract product data from Amazon"
        );
        return;
      }

      setProduct(result.product);
      setNameOverride(result.product.title);
      setPriceOverride(
        result.product.price !== null ? result.product.price.toString() : ""
      );
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
      const result = await importAmazonProductAction(tenantId, product, {
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
          <CardTitle className="text-lg">Amazon Product URL</CardTitle>
          <CardDescription>
            Paste the full URL of an Amazon product page (supports amazon.ae,
            amazon.com, and other Amazon domains)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScrape} className="flex gap-3">
            <Input
              placeholder="https://www.amazon.ae/dp/B0F6NP452Y"
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
          <AmazonProductPreview product={product} />

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
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={nameOverride}
                  onChange={(e) => setNameOverride(e.target.value)}
                  placeholder="Product name"
                />
              </div>

              {/* Price Override */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ({currency})</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder="0.00"
                  />
                  {product.currency !== currency && product.price !== null && (
                    <p className="text-xs text-muted-foreground">
                      Original: {product.currency} {product.price.toFixed(2)}
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
