"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Minus, Equal, Loader2 } from "lucide-react";

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

import { adjustStock } from "@/lib/actions/inventory";

interface QuickAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  productId: string;
  productName: string;
  currentStock: number;
  variantId?: string;
  variantName?: string;
}

export function QuickAdjustDialog({
  open,
  onOpenChange,
  tenantId,
  productId,
  productName,
  currentStock,
  variantId,
  variantName,
}: QuickAdjustDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [adjustmentType, setAdjustmentType] = useState<
    "add" | "remove" | "set"
  >("add");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const newStock = (() => {
    const qty = parseInt(quantity) || 0;
    if (adjustmentType === "add") return currentStock + qty;
    if (adjustmentType === "remove") return Math.max(0, currentStock - qty);
    return qty;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (adjustmentType !== "set" && qty === 0) {
      toast.error("Quantity cannot be zero for add/remove");
      return;
    }

    startTransition(async () => {
      const result = await adjustStock(tenantId, {
        productId,
        variantId,
        adjustmentType,
        quantity: qty,
        notes: notes.trim() || undefined,
      });

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
        setQuantity("");
        setNotes("");
        setAdjustmentType("add");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to adjust stock");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {productName}
              {variantName && ` - ${variantName}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Stock Display */}
            <div className="rounded-lg border bg-muted/50 p-3 text-center">
              <p className="text-sm text-muted-foreground">Current Stock</p>
              <p className="text-2xl font-bold">{currentStock}</p>
            </div>

            {/* Adjustment Type */}
            <RadioGroup
              value={adjustmentType}
              onValueChange={(value) =>
                setAdjustmentType(value as "add" | "remove" | "set")
              }
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="quick-add"
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  adjustmentType === "add"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem
                  value="add"
                  id="quick-add"
                  className="sr-only"
                />
                <Plus className="size-4 text-green-600" />
                <span className="text-xs font-medium">Add</span>
              </Label>
              <Label
                htmlFor="quick-remove"
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  adjustmentType === "remove"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem
                  value="remove"
                  id="quick-remove"
                  className="sr-only"
                />
                <Minus className="size-4 text-destructive" />
                <span className="text-xs font-medium">Remove</span>
              </Label>
              <Label
                htmlFor="quick-set"
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  adjustmentType === "set"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem
                  value="set"
                  id="quick-set"
                  className="sr-only"
                />
                <Equal className="size-4 text-blue-600" />
                <span className="text-xs font-medium">Set</span>
              </Label>
            </RadioGroup>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quick-quantity">Quantity</Label>
              <Input
                id="quick-quantity"
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Enter quantity"
                autoFocus
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="quick-notes">Notes (optional)</Label>
              <Textarea
                id="quick-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Received shipment from supplier"
                rows={2}
              />
            </div>

            {/* New Stock Preview */}
            {quantity && (
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-sm text-muted-foreground">New Stock</p>
                <div className="flex items-baseline justify-center gap-2">
                  <p className="text-2xl font-bold">{newStock}</p>
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !quantity}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adjusting...
                </>
              ) : (
                "Adjust"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
