"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { ScheduledSale, Product } from "@/lib/db/schema";
import { formatPrice, cn } from "@/lib/utils";
import {
  createScheduledSaleAction,
  updateScheduledSaleAction,
  type ScheduledSaleInput,
} from "@/lib/actions/scheduled-sales";

interface ScheduledSaleFormProps {
  tenantId: string;
  currency: string;
  products: Pick<Product, "id" | "name" | "price">[];
  sale?: ScheduledSale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduledSaleForm({
  tenantId,
  currency,
  products,
  sale,
  open,
  onOpenChange,
  onSuccess,
}: ScheduledSaleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [productOpen, setProductOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [selectedProductId, setSelectedProductId] = useState(
    sale?.productId || ""
  );
  const [name, setName] = useState(sale?.name || "");
  const [salePrice, setSalePrice] = useState(sale?.salePrice || "");
  const [startsAt, setStartsAt] = useState(
    sale?.startsAt ? formatDateTimeLocal(new Date(sale.startsAt)) : ""
  );
  const [endsAt, setEndsAt] = useState(
    sale?.endsAt ? formatDateTimeLocal(new Date(sale.endsAt)) : ""
  );
  const [priority, setPriority] = useState(String(sale?.priority ?? 0));
  const [isActive, setIsActive] = useState(sale?.isActive ?? true);

  const isEditing = !!sale;

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const discount = useMemo(() => {
    if (!selectedProduct || !salePrice) return null;
    const base = parseFloat(selectedProduct.price);
    const sale = parseFloat(salePrice);
    if (isNaN(base) || isNaN(sale) || base <= 0) return null;
    if (sale >= base) return null;
    return Math.round(((base - sale) / base) * 100);
  }, [selectedProduct, salePrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    if (!selectedProductId) {
      setErrors({ productId: "Please select a product" });
      return;
    }

    if (!salePrice || parseFloat(salePrice) < 0) {
      setErrors({ salePrice: "Please enter a valid sale price" });
      return;
    }

    if (!startsAt) {
      setErrors({ startsAt: "Please select a start date" });
      return;
    }

    if (!endsAt) {
      setErrors({ endsAt: "Please select an end date" });
      return;
    }

    startTransition(async () => {
      const input: ScheduledSaleInput = {
        productId: selectedProductId,
        name: name.trim() || undefined,
        salePrice,
        startsAt,
        endsAt,
        priority: parseInt(priority) || 0,
        isActive,
      };

      const result = isEditing
        ? await updateScheduledSaleAction(sale.id, input)
        : await createScheduledSaleAction(tenantId, input);

      if (!result.success) {
        if (result.error?.field) {
          setErrors({ [result.error.field]: result.error.message });
        } else {
          toast.error(result.error?.message || "Something went wrong");
        }
        return;
      }

      toast.success(isEditing ? "Sale updated" : "Sale created");
      onOpenChange(false);
      onSuccess?.();

      // Reset form if creating
      if (!isEditing) {
        setSelectedProductId("");
        setName("");
        setSalePrice("");
        setStartsAt("");
        setEndsAt("");
        setPriority("0");
        setIsActive(true);
      }
    });
  };

  // Reset form when dialog opens with new sale
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && sale) {
      setSelectedProductId(sale.productId);
      setName(sale.name || "");
      setSalePrice(sale.salePrice);
      setStartsAt(formatDateTimeLocal(new Date(sale.startsAt)));
      setEndsAt(formatDateTimeLocal(new Date(sale.endsAt)));
      setPriority(String(sale.priority ?? 0));
      setIsActive(sale.isActive);
    } else if (newOpen && !sale) {
      setSelectedProductId("");
      setName("");
      setSalePrice("");
      // Default to starting now and ending in 7 days
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setStartsAt(formatDateTimeLocal(now));
      setEndsAt(formatDateTimeLocal(weekLater));
      setPriority("0");
      setIsActive(true);
    }
    setErrors({});
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Scheduled Sale" : "Create Scheduled Sale"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the sale details."
              : "Schedule a time-limited discount for a product."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Selector */}
          <div className="space-y-2">
            <Label>
              Product <span className="text-destructive">*</span>
            </Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className={cn(
                    "w-full justify-between",
                    !selectedProductId && "text-muted-foreground"
                  )}
                  disabled={isPending || isEditing}
                >
                  {selectedProduct ? (
                    <span className="truncate">{selectedProduct.name}</span>
                  ) : (
                    "Select a product..."
                  )}
                  <Search className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-100 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandList>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.name}
                          onSelect={() => {
                            setSelectedProductId(product.id);
                            setProductOpen(false);
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate">{product.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatPrice(parseFloat(product.price), currency)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.productId && (
              <p className="text-sm text-destructive">{errors.productId}</p>
            )}
          </div>

          {/* Sale Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="name">Sale Name (Optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Sale, Flash Deal"
              disabled={isPending}
            />
          </div>

          {/* Sale Price */}
          <div className="space-y-2">
            <Label htmlFor="salePrice">
              Sale Price ({currency}){" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="0.00"
                disabled={isPending}
                className="flex-1"
              />
              {discount !== null && (
                <span className="text-sm font-medium text-green-600 whitespace-nowrap">
                  -{discount}% off
                </span>
              )}
            </div>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Original price:{" "}
                {formatPrice(parseFloat(selectedProduct.price), currency)}
              </p>
            )}
            {errors.salePrice && (
              <p className="text-sm text-destructive">{errors.salePrice}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">
                Starts At <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={isPending}
              />
              {errors.startsAt && (
                <p className="text-sm text-destructive">{errors.startsAt}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">
                Ends At <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={isPending}
              />
              {errors.endsAt && (
                <p className="text-sm text-destructive">{errors.endsAt}</p>
              )}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              min="0"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={isPending}
            />
            <p className="text-sm text-muted-foreground">
              Higher priority sales take precedence when multiple sales overlap
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active</Label>
              <p className="text-sm text-muted-foreground">
                Sale will be applied during the scheduled period
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
