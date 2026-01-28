"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Minus,
  Equal,
  Loader2,
  Package,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { bulkAdjustStock } from "@/lib/actions/inventory";
import { getProductsForBulkAdjustment } from "@/lib/db/queries/inventory";

type BulkProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  newQuantity: string;
  hasVariants: boolean;
};

interface BulkAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  selectedProductIds: string[];
}

export function BulkAdjustDialog({
  open,
  onOpenChange,
  tenantId,
  selectedProductIds,
}: BulkAdjustDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const [products, setProducts] = useState<BulkProduct[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<
    "add" | "remove" | "set"
  >("add");
  const [globalQuantity, setGlobalQuantity] = useState("");
  const [useGlobalQuantity, setUseGlobalQuantity] = useState(true);
  const [reason, setReason] = useState("");

  // Load product details when dialog opens
  useEffect(() => {
    if (!open || selectedProductIds.length === 0) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const productData = await getProductsForBulkAdjustment(
          tenantId,
          selectedProductIds
        );
        setProducts(
          productData
            .filter((p) => !p.hasVariants) // Only simple products for bulk adjust
            .map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              stock: p.stock,
              newQuantity: "",
              hasVariants: p.hasVariants,
            }))
        );
      } catch (error) {
        console.error("Failed to load products:", error);
        toast.error("Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [open, selectedProductIds, tenantId]);

  const updateProductQuantity = (productId: string, quantity: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, newQuantity: quantity } : p
      )
    );
  };

  const calculateNewStock = (currentStock: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    if (adjustmentType === "add") return currentStock + qty;
    if (adjustmentType === "remove") return Math.max(0, currentStock - qty);
    return qty;
  };

  const handleSubmit = async () => {
    const adjustments = products
      .map((p) => {
        const quantity = useGlobalQuantity
          ? parseInt(globalQuantity) || 0
          : parseInt(p.newQuantity) || 0;
        if (quantity === 0 && adjustmentType !== "set") return null;
        return {
          productId: p.id,
          adjustmentType,
          quantity,
          reason: reason || undefined,
        };
      })
      .filter(Boolean);

    if (adjustments.length === 0) {
      toast.error("Please enter valid quantities");
      return;
    }

    startTransition(async () => {
      const result = await bulkAdjustStock(
        tenantId,
        adjustments as Array<{
          productId: string;
          adjustmentType: "add" | "remove" | "set";
          quantity: number;
          reason?: string;
        }>
      );

      if (result.success) {
        const successCount =
          result.results?.filter((r) => r.success).length || 0;
        const failCount = result.results?.filter((r) => !r.success).length || 0;

        if (failCount === 0) {
          toast.success(`Successfully adjusted ${successCount} products`);
        } else {
          toast.warning(
            `Adjusted ${successCount} products, ${failCount} failed`
          );
        }

        setGlobalQuantity("");
        setReason("");
        setProducts([]);
        onOpenChange(false);
        router.refresh();
      } else {
        // Get first error message from failed results
        const firstError = result.results?.find((r) => !r.success)?.error;
        toast.error(firstError || "Failed to adjust stock");
      }
    });
  };

  const variantProductsExcluded = selectedProductIds.length - products.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Stock Adjustment</DialogTitle>
          <DialogDescription>
            Adjust stock for {products.length} selected product(s)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="mb-2 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No eligible products selected for bulk adjustment.
            </p>
            <p className="text-sm text-muted-foreground">
              Products with variants must be adjusted individually.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {variantProductsExcluded > 0 && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {variantProductsExcluded} product(s) with variants were
                  excluded. Products with variants must be adjusted
                  individually.
                </AlertDescription>
              </Alert>
            )}

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
                  htmlFor="bulk-add"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "add"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value="add"
                    id="bulk-add"
                    className="sr-only"
                  />
                  <Plus className="size-5 text-green-600" />
                  <span className="text-sm font-medium">Add</span>
                </Label>
                <Label
                  htmlFor="bulk-remove"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "remove"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value="remove"
                    id="bulk-remove"
                    className="sr-only"
                  />
                  <Minus className="size-5 text-destructive" />
                  <span className="text-sm font-medium">Remove</span>
                </Label>
                <Label
                  htmlFor="bulk-set"
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    adjustmentType === "set"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem
                    value="set"
                    id="bulk-set"
                    className="sr-only"
                  />
                  <Equal className="size-5 text-blue-600" />
                  <span className="text-sm font-medium">Set To</span>
                </Label>
              </RadioGroup>
            </div>

            <Separator />

            {/* Global Quantity vs Individual */}
            <div className="flex items-center gap-4">
              <Button
                variant={useGlobalQuantity ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setUseGlobalQuantity(true)}
              >
                Same quantity for all
              </Button>
              <Button
                variant={!useGlobalQuantity ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setUseGlobalQuantity(false)}
              >
                Individual quantities
              </Button>
            </div>

            {useGlobalQuantity ? (
              <div className="space-y-2">
                <Label htmlFor="global-quantity">
                  Quantity for all products
                </Label>
                <Input
                  id="global-quantity"
                  type="number"
                  min="0"
                  value={globalQuantity}
                  onChange={(e) => setGlobalQuantity(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="Enter quantity"
                  className="max-w-50"
                />
              </div>
            ) : (
              <ScrollArea className="h-50 rounded-md border p-3">
                <div className="space-y-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Current: {product.stock}
                          {product.newQuantity && (
                            <span className="ml-2">
                              →{" "}
                              {calculateNewStock(
                                product.stock,
                                product.newQuantity
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={product.newQuantity}
                        onChange={(e) =>
                          updateProductQuantity(product.id, e.target.value)
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Qty"
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Preview */}
            {(useGlobalQuantity ? globalQuantity : true) && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium">Preview</p>
                <ScrollArea className="mt-2 max-h-30">
                  <div className="space-y-1">
                    {products.slice(0, 5).map((product) => {
                      const qty = useGlobalQuantity
                        ? globalQuantity
                        : product.newQuantity;
                      const newStock = calculateNewStock(product.stock, qty);
                      const diff = newStock - product.stock;
                      return (
                        <div
                          key={product.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate">{product.name}</span>
                          <span>
                            {product.stock} → {newStock}{" "}
                            <Badge
                              variant={
                                diff > 0
                                  ? "default"
                                  : diff < 0
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="ml-1"
                            >
                              {diff > 0 ? "+" : ""}
                              {diff}
                            </Badge>
                          </span>
                        </div>
                      );
                    })}
                    {products.length > 5 && (
                      <p className="text-muted-foreground">
                        ...and {products.length - 5} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Reason (optional)</Label>
              <Textarea
                id="bulk-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Stock count correction, Inventory audit"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              products.length === 0 ||
              (useGlobalQuantity && !globalQuantity)
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Adjusting...
              </>
            ) : (
              `Adjust ${products.length} Products`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
