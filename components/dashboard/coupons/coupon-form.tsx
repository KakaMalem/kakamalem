"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info, X, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

import { formatPrice, cn } from "@/lib/utils";
import {
  couponSchema,
  type CouponInput,
  type DiscountType,
  type DiscountScope,
} from "@/lib/validations/coupons";
import { createCouponAction, updateCouponAction } from "@/lib/actions/coupons";
import type { CouponDetails } from "@/lib/db/queries/coupons";

type ProductForSelect = {
  id: string;
  name: string;
};

interface CouponFormProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  coupon?: CouponDetails | null;
  products?: ProductForSelect[];
}

type FormErrors = Partial<Record<keyof CouponInput, string>>;

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CouponForm({
  tenantId,
  storeSlug,
  currency,
  coupon,
  products = [],
}: CouponFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  const isEditing = !!coupon;

  // Form state
  const [code, setCode] = useState(coupon?.code || "");
  const [name, setName] = useState(coupon?.name || "");
  const [description, setDescription] = useState(coupon?.description || "");
  const [type, setType] = useState<DiscountType>(coupon?.type || "percentage");
  const [value, setValue] = useState(coupon?.value || "");
  const [scope, setScope] = useState<DiscountScope>(coupon?.scope || "order");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    coupon?.eligibleProducts || []
  );
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(
    coupon?.minimumOrderAmount || ""
  );
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState(
    coupon?.maximumDiscountAmount || ""
  );
  const [usageLimit, setUsageLimit] = useState(
    coupon?.usageLimit?.toString() || ""
  );
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = useState(
    coupon?.usageLimitPerCustomer?.toString() || ""
  );
  const [startsAt, setStartsAt] = useState(
    coupon?.startsAt
      ? formatDateTimeLocal(new Date(coupon.startsAt))
      : formatDateTimeLocal(new Date())
  );
  const [expiresAt, setExpiresAt] = useState(
    coupon?.expiresAt ? formatDateTimeLocal(new Date(coupon.expiresAt)) : ""
  );
  const [firstOrderOnly, setFirstOrderOnly] = useState(
    coupon?.firstOrderOnly || false
  );
  const [combinable, setCombinable] = useState(coupon?.combinable || false);
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);

  // Get selected products details for display
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Remove a product from selection
  const removeProduct = (productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  // Auto-uppercase code
  const handleCodeChange = (value: string) => {
    setCode(value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
  };

  // Scroll to first error
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const element = document.getElementById(firstErrorField);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => element.focus(), 300);
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: CouponInput = {
      code,
      name,
      description: description || null,
      type,
      value,
      scope,
      minimumOrderAmount: minimumOrderAmount || null,
      maximumDiscountAmount: maximumDiscountAmount || null,
      usageLimit: usageLimit || null,
      usageLimitPerCustomer: usageLimitPerCustomer || null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      eligibleProducts:
        scope === "item" && selectedProductIds.length > 0
          ? selectedProductIds
          : null,
      eligibleCategories: null,
      eligibleCustomerGroups: null,
      excludedProducts: null,
      firstOrderOnly,
      combinable,
      isActive,
    };

    // Client-side validation
    const result = couponSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CouponInput;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Please fix the errors below");
      return;
    }

    startTransition(async () => {
      try {
        const actionResult = isEditing
          ? await updateCouponAction(tenantId, storeSlug, coupon.id, formData)
          : await createCouponAction(tenantId, storeSlug, formData);

        if (actionResult.success) {
          toast.success(
            isEditing ? "Promo code updated" : "Promo code created"
          );
          router.push(`/dashboard/${storeSlug}/coupons`);
          router.refresh();
        } else {
          if (actionResult.error?.field) {
            setErrors({
              [actionResult.error.field]: actionResult.error.message,
            });
          }
          toast.error(actionResult.error?.message || "Something went wrong");
        }
      } catch (error) {
        console.error("Form submission error:", error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Promo Code Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="e.g., SAVE20"
                    disabled={isPending}
                    className={errors.code ? "border-destructive" : ""}
                    maxLength={50}
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive">{errors.code}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, hyphens, and underscores only
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Summer Sale 20% Off"
                    disabled={isPending}
                    className={errors.name ? "border-destructive" : ""}
                    maxLength={100}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about this promo code"
                  disabled={isPending}
                  rows={2}
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>

          {/* Discount Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Discount Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="type">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as DiscountType)}
                    disabled={isPending}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                      <SelectItem value="free_shipping">
                        Free Shipping
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">
                    {type === "percentage" ? "Percentage" : "Amount"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="value"
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === "percentage" ? "20" : "100"}
                      disabled={isPending || type === "free_shipping"}
                      className={errors.value ? "border-destructive" : ""}
                      min="0"
                      max={type === "percentage" ? "100" : undefined}
                      step="0.01"
                    />
                    {type === "percentage" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    )}
                    {type === "fixed_amount" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {currency}
                      </span>
                    )}
                  </div>
                  {errors.value && (
                    <p className="text-sm text-destructive">{errors.value}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope">Applies To</Label>
                  <Select
                    value={scope}
                    onValueChange={(v) => {
                      setScope(v as DiscountScope);
                      // Clear selected products if switching away from item scope
                      if (v !== "item") {
                        setSelectedProductIds([]);
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger id="scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">Entire Order</SelectItem>
                      <SelectItem value="item">Specific Products</SelectItem>
                      <SelectItem value="shipping">Shipping Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product Selector - only shown when scope is "item" */}
              {scope === "item" && (
                <div className="space-y-2">
                  <Label>
                    Eligible Products
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-1 inline size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Only these products will receive the discount</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>

                  {/* Selected products display */}
                  {selectedProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                      {selectedProducts.map((product) => (
                        <Badge
                          key={product.id}
                          variant="secondary"
                          className="gap-1"
                        >
                          <span className="max-w-32 truncate">
                            {product.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            className="ml-1 rounded-full hover:bg-muted"
                            disabled={isPending}
                          >
                            <X className="size-3" />
                            <span className="sr-only">
                              Remove {product.name}
                            </span>
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Product selector popover */}
                  <Popover
                    open={productSelectorOpen}
                    onOpenChange={setProductSelectorOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productSelectorOpen}
                        className="w-full justify-between"
                        disabled={isPending}
                      >
                        {selectedProductIds.length > 0
                          ? `${selectedProductIds.length} product${selectedProductIds.length > 1 ? "s" : ""} selected`
                          : "Select products..."}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search products..." />
                        <CommandList>
                          <CommandEmpty>No products found.</CommandEmpty>
                          <CommandGroup>
                            {products.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => toggleProduct(product.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    selectedProductIds.includes(product.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{product.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {scope === "item" && selectedProductIds.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Select at least one product for the discount to apply
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minimumOrderAmount">
                    Minimum Order Amount
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-1 inline size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Customers must spend at least this amount to use the
                            code
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="relative">
                    <Input
                      id="minimumOrderAmount"
                      type="number"
                      value={minimumOrderAmount}
                      onChange={(e) => setMinimumOrderAmount(e.target.value)}
                      placeholder="0"
                      disabled={isPending}
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currency}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maximumDiscountAmount">
                    Maximum Discount
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-1 inline size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Cap the discount at this amount (for percentage)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <div className="relative">
                    <Input
                      id="maximumDiscountAmount"
                      type="number"
                      value={maximumDiscountAmount}
                      onChange={(e) => setMaximumDiscountAmount(e.target.value)}
                      placeholder="No limit"
                      disabled={isPending}
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currency}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="usageLimit">Total Usage Limit</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder="Unlimited"
                    disabled={isPending}
                    min="1"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many times this code can be used in total
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usageLimitPerCustomer">Per Customer</Label>
                  <Input
                    id="usageLimitPerCustomer"
                    type="number"
                    value={usageLimitPerCustomer}
                    onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
                    placeholder="Unlimited"
                    disabled={isPending}
                    min="1"
                    step="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many times each customer can use this code
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validity Period */}
          <Card>
            <CardHeader>
              <CardTitle>Validity Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Start Date & Time</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    disabled={isPending}
                    className={errors.startsAt ? "border-destructive" : ""}
                  />
                  {errors.startsAt && (
                    <p className="text-sm text-destructive">
                      {errors.startsAt}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">End Date & Time</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    disabled={isPending}
                    className={errors.expiresAt ? "border-destructive" : ""}
                  />
                  {errors.expiresAt && (
                    <p className="text-sm text-destructive">
                      {errors.expiresAt}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Leave empty for no expiration
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this promo code
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Restrictions */}
          <Card>
            <CardHeader>
              <CardTitle>Restrictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="firstOrderOnly">First Order Only</Label>
                  <p className="text-xs text-muted-foreground">
                    Only for new customers
                  </p>
                </div>
                <Switch
                  id="firstOrderOnly"
                  checked={firstOrderOnly}
                  onCheckedChange={setFirstOrderOnly}
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="combinable">Combinable</Label>
                  <p className="text-xs text-muted-foreground">
                    Can combine with other codes
                  </p>
                </div>
                <Switch
                  id="combinable"
                  checked={combinable}
                  onCheckedChange={setCombinable}
                  disabled={isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {value && type !== "free_shipping" && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-2">
                  <div className="font-mono text-xl font-bold">
                    {code || "CODE"}
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    {type === "percentage"
                      ? `${value}% OFF`
                      : formatPrice(parseFloat(value) || 0, currency) + " OFF"}
                  </div>
                  {minimumOrderAmount && (
                    <div className="text-xs text-muted-foreground">
                      Min. order:{" "}
                      {formatPrice(parseFloat(minimumOrderAmount), currency)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : isEditing ? (
              "Update Promo Code"
            ) : (
              "Create Promo Code"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
