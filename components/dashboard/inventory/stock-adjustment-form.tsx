"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Minus, Equal, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { adjustStock, type AdjustmentInput } from "@/lib/actions/inventory";
import { getProductForAdjustment } from "@/lib/db/queries/inventory";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  stock: number;
  hasVariants: boolean;
  trackInventory: boolean;
};

type ProductWithVariants = Awaited<
  ReturnType<typeof getProductForAdjustment>
> | null;

interface StockAdjustmentFormProps {
  tenantId: string;
  storeSlug: string;
  products: ProductOption[];
  preselectedProductId?: string;
}

export function StockAdjustmentForm({
  tenantId,
  storeSlug,
  products,
  preselectedProductId,
}: StockAdjustmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState(
    preselectedProductId || ""
  );
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<
    "add" | "remove" | "set"
  >("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  // Product details (loaded when product is selected)
  const [productDetails, setProductDetails] =
    useState<ProductWithVariants>(null);

  // Load product details when product is selected
  useEffect(() => {
    if (!selectedProductId) {
      setProductDetails(null);
      setSelectedVariantId("");
      return;
    }

    const loadProduct = async () => {
      setIsLoadingProduct(true);
      try {
        const details = await getProductForAdjustment(
          tenantId,
          selectedProductId
        );
        setProductDetails(details);
        setSelectedVariantId("");
      } catch (error) {
        console.error("Failed to load product:", error);
        toast.error("Failed to load product details");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    loadProduct();
  }, [selectedProductId, tenantId]);

  const currentStock = (() => {
    if (!productDetails) return 0;
    if (productDetails.hasVariants && selectedVariantId) {
      const variant = productDetails.variants?.find(
        (v) => v.id === selectedVariantId
      );
      return variant?.stock ?? 0;
    }
    return productDetails.stock;
  })();

  const newStock = (() => {
    const qty = parseInt(quantity) || 0;
    if (adjustmentType === "add") return currentStock + qty;
    if (adjustmentType === "remove") return Math.max(0, currentStock - qty);
    return qty;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    if (productDetails?.hasVariants && !selectedVariantId) {
      toast.error("Please select a variant");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (adjustmentType !== "set" && qty === 0) {
      toast.error("Quantity cannot be zero for add/remove");
      return;
    }

    const input: AdjustmentInput = {
      productId: selectedProductId,
      variantId: selectedVariantId || undefined,
      adjustmentType,
      quantity: qty,
      reason: reason || undefined,
    };

    startTransition(async () => {
      const result = await adjustStock(tenantId, input);

      if (result.success) {
        toast.success(
          `Stock ${
            adjustmentType === "set"
              ? "set to"
              : adjustmentType === "add"
                ? "increased by"
                : "decreased by"
          } ${qty}`
        );
        // Reset form
        setQuantity("");
        setReason("");
        // Refresh product details
        if (selectedProductId) {
          const details = await getProductForAdjustment(
            tenantId,
            selectedProductId
          );
          setProductDetails(details);
        }
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to adjust stock");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        <span>{product.name}</span>
                        {!product.hasVariants && (
                          <span className="text-muted-foreground">
                            ({product.stock} in stock)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Variant Selection */}
            {productDetails?.hasVariants && (
              <div className="space-y-2">
                <Label htmlFor="variant">Variant</Label>
                {isLoadingProduct ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading variants...
                  </div>
                ) : (
                  <Select
                    value={selectedVariantId}
                    onValueChange={setSelectedVariantId}
                  >
                    <SelectTrigger id="variant">
                      <SelectValue placeholder="Select a variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {productDetails.variants?.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          <div className="flex items-center gap-2">
                            <span>
                              {variant.displayName || variant.sku || variant.id}
                            </span>
                            <span className="text-muted-foreground">
                              ({variant.stock} in stock)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Current Stock Display */}
            {productDetails &&
              (!productDetails.hasVariants || selectedVariantId) && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">Current Stock</p>
                  <p className="text-3xl font-bold">{currentStock}</p>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Adjustment Options */}
        <Card>
          <CardHeader>
            <CardTitle>Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adjustment Type */}
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <RadioGroup
                value={adjustmentType}
                onValueChange={(value) =>
                  setAdjustmentType(value as "add" | "remove" | "set")
                }
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="add"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "add"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="add" id="add" className="sr-only" />
                  <Plus className="size-5 text-green-600" />
                  <span className="text-sm font-medium">Add</span>
                </Label>
                <Label
                  htmlFor="remove"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "remove"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value="remove"
                    id="remove"
                    className="sr-only"
                  />
                  <Minus className="size-5 text-destructive" />
                  <span className="text-sm font-medium">Remove</span>
                </Label>
                <Label
                  htmlFor="set"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "set"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value="set" id="set" className="sr-only" />
                  <Equal className="size-5 text-blue-600" />
                  <span className="text-sm font-medium">Set To</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter quantity"
              />
            </div>

            {/* New Stock Preview */}
            {quantity && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">New Stock</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold">{newStock}</p>
                  <p className="text-sm text-muted-foreground">
                    {adjustmentType === "add" && (
                      <span className="text-green-600">
                        (+{parseInt(quantity) || 0})
                      </span>
                    )}
                    {adjustmentType === "remove" && (
                      <span className="text-destructive">
                        (-{Math.min(parseInt(quantity) || 0, currentStock)})
                      </span>
                    )}
                    {adjustmentType === "set" && (
                      <span className="text-blue-600">
                        ({newStock > currentStock ? "+" : ""}
                        {newStock - currentStock})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Received new shipment, Inventory count correction"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/${storeSlug}/inventory`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isPending ||
            !selectedProductId ||
            (productDetails?.hasVariants && !selectedVariantId) ||
            !quantity
          }
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Adjusting...
            </>
          ) : (
            "Adjust Stock"
          )}
        </Button>
      </div>
    </form>
  );
}
