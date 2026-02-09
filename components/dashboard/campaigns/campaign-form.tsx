"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X, Check, ChevronsUpDown } from "lucide-react";

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
import { DateTimePicker } from "@/components/ui/date-time-picker";

import { formatPrice, cn } from "@/lib/utils";
import {
  campaignSchema,
  type CampaignInput,
  type CampaignScope,
  type CampaignDiscountType,
} from "@/lib/validations/campaigns";
import {
  createCampaignAction,
  updateCampaignAction,
} from "@/lib/actions/campaigns";
import type { CampaignDetails } from "@/lib/db/queries/campaigns";

type ItemForSelect = {
  id: string;
  name: string;
};

interface CampaignFormProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  campaign?: CampaignDetails | null;
  categories?: ItemForSelect[];
  products?: ItemForSelect[];
}

type FormErrors = Partial<Record<keyof CampaignInput, string>>;

export function CampaignForm({
  tenantId,
  storeSlug,
  currency,
  campaign,
  categories = [],
  products = [],
}: CampaignFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FormErrors>({});
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  const isEditing = !!campaign;

  // Form state
  const [name, setName] = useState(campaign?.name || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [discountType, setDiscountType] = useState<CampaignDiscountType>(
    campaign?.discountType || "percentage"
  );
  const [discountValue, setDiscountValue] = useState(
    campaign?.discountValue || ""
  );
  const [scope, setScope] = useState<CampaignScope>(
    campaign?.scope || "store_wide"
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    campaign?.eligibleCategories || []
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    campaign?.eligibleProducts || []
  );
  const [startsAt, setStartsAt] = useState<Date | null>(
    campaign?.startsAt ? new Date(campaign.startsAt) : new Date()
  );
  const [endsAt, setEndsAt] = useState<Date | null>(() => {
    if (campaign?.endsAt) return new Date(campaign.endsAt);
    // Default: 7 days from now
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    return defaultEnd;
  });
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(
    campaign?.minimumOrderAmount || ""
  );
  const [showBadge, setShowBadge] = useState(campaign?.showBadge ?? true);
  const [badgeText, setBadgeText] = useState(campaign?.badgeText || "");
  const [badgeTextManuallyEdited, setBadgeTextManuallyEdited] = useState(
    !!campaign?.badgeText
  );
  const [isActive, setIsActive] = useState(campaign?.isActive ?? true);
  const [priority, setPriority] = useState(campaign?.priority ?? 0);

  // Selected items for display
  const selectedCategories = useMemo(
    () => categories.filter((c) => selectedCategoryIds.includes(c.id)),
    [categories, selectedCategoryIds]
  );
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  // Toggle functions
  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Auto-generate badge text when discount value changes (unless manually edited)
  useEffect(() => {
    if (!badgeTextManuallyEdited && discountValue) {
      if (discountType === "percentage") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBadgeText(`${discountValue}% OFF`);
      } else {
        setBadgeText(`${formatPrice(parseFloat(discountValue), currency)} OFF`);
      }
    }
  }, [discountValue, discountType, currency, badgeTextManuallyEdited]);

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

    if (!startsAt || !endsAt) {
      toast.error("Please select start and end dates");
      return;
    }

    const formData: CampaignInput = {
      name,
      description: description || null,
      slug: null,
      discountType,
      discountValue,
      scope,
      eligibleCategories: scope === "categories" ? selectedCategoryIds : null,
      eligibleProducts: scope === "products" ? selectedProductIds : null,
      excludedProducts: null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      minimumOrderAmount: minimumOrderAmount || null,
      showBadge,
      badgeText: showBadge && badgeText ? badgeText : null,
      bannerImage: null,
      isActive,
      priority,
    };

    // Client-side validation
    const result = campaignSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CampaignInput;
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
          ? await updateCampaignAction(
              tenantId,
              storeSlug,
              campaign.id,
              formData
            )
          : await createCampaignAction(tenantId, storeSlug, formData);

        if (actionResult.success) {
          toast.success(isEditing ? "Campaign updated" : "Campaign created");
          router.push(`/dashboard/${storeSlug}/campaigns`);
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
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Campaign Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Black Friday 2025"
                  disabled={isPending}
                  className={errors.name ? "border-destructive" : ""}
                  maxLength={255}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about this campaign"
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discountType">
                    Discount Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={discountType}
                    onValueChange={(v) =>
                      setDiscountType(v as CampaignDiscountType)
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="discountType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Off</SelectItem>
                      <SelectItem value="fixed_amount">
                        Fixed Amount Off
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountValue">
                    {discountType === "percentage" ? "Percentage" : "Amount"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="discountValue"
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder={discountType === "percentage" ? "20" : "100"}
                      disabled={isPending}
                      className={
                        errors.discountValue ? "border-destructive" : ""
                      }
                      min="0"
                      max={discountType === "percentage" ? "100" : undefined}
                      step="0.01"
                    />
                    {discountType === "percentage" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    )}
                    {discountType === "fixed_amount" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {currency}
                      </span>
                    )}
                  </div>
                  {errors.discountValue && (
                    <p className="text-sm text-destructive">
                      {errors.discountValue}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">
                  Applies To <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={scope}
                  onValueChange={(v) => {
                    setScope(v as CampaignScope);
                    if (v === "store_wide") {
                      setSelectedCategoryIds([]);
                      setSelectedProductIds([]);
                    }
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger id="scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="store_wide">
                      Entire Store (All Products)
                    </SelectItem>
                    <SelectItem value="categories">
                      Specific Categories
                    </SelectItem>
                    <SelectItem value="products">Specific Products</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Selector */}
              {scope === "categories" && (
                <div className="space-y-2">
                  <Label>Select Categories</Label>

                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                      {selectedCategories.map((cat) => (
                        <Badge
                          key={cat.id}
                          variant="secondary"
                          className="gap-1"
                        >
                          <span className="max-w-32 truncate">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.id)}
                            className="ml-1 rounded-full hover:bg-muted"
                            disabled={isPending}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Popover
                    open={categorySelectorOpen}
                    onOpenChange={setCategorySelectorOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categorySelectorOpen}
                        className="w-full justify-between"
                        disabled={isPending}
                      >
                        {selectedCategoryIds.length > 0
                          ? `${selectedCategoryIds.length} categor${selectedCategoryIds.length > 1 ? "ies" : "y"} selected`
                          : "Select categories..."}
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search categories..." />
                        <CommandList>
                          <CommandEmpty>No categories found.</CommandEmpty>
                          <CommandGroup>
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => toggleCategory(cat.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    selectedCategoryIds.includes(cat.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{cat.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {errors.eligibleCategories && (
                    <p className="text-sm text-destructive">
                      {errors.eligibleCategories}
                    </p>
                  )}
                </div>
              )}

              {/* Product Selector */}
              {scope === "products" && (
                <div className="space-y-2">
                  <Label>Select Products</Label>

                  {selectedProducts.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                      {selectedProducts.map((prod) => (
                        <Badge
                          key={prod.id}
                          variant="secondary"
                          className="gap-1"
                        >
                          <span className="max-w-32 truncate">{prod.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleProduct(prod.id)}
                            className="ml-1 rounded-full hover:bg-muted"
                            disabled={isPending}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

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
                            {products.map((prod) => (
                              <CommandItem
                                key={prod.id}
                                value={prod.name}
                                onSelect={() => toggleProduct(prod.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 size-4",
                                    selectedProductIds.includes(prod.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{prod.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {errors.eligibleProducts && (
                    <p className="text-sm text-destructive">
                      {errors.eligibleProducts}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="minimumOrderAmount">Minimum Order Amount</Label>
                <div className="relative">
                  <Input
                    id="minimumOrderAmount"
                    type="number"
                    value={minimumOrderAmount}
                    onChange={(e) => setMinimumOrderAmount(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="No minimum"
                    disabled={isPending}
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {currency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startsAt">
                    Start Date & Time{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    id="startsAt"
                    value={startsAt}
                    onChange={setStartsAt}
                    placeholder="Select start date"
                    disabled={isPending}
                    hasError={!!errors.startsAt}
                  />
                  {errors.startsAt && (
                    <p className="text-sm text-destructive">
                      {errors.startsAt}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endsAt">
                    End Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    id="endsAt"
                    value={endsAt}
                    onChange={setEndsAt}
                    placeholder="Select end date"
                    disabled={isPending}
                    minDate={startsAt || undefined}
                    hasError={!!errors.endsAt}
                  />
                  {errors.endsAt && (
                    <p className="text-sm text-destructive">{errors.endsAt}</p>
                  )}
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isActive">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this campaign
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                  disabled={isPending}
                  min="0"
                  max="100"
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority campaigns take precedence
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Display Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showBadge">Show Sale Badge</Label>
                  <p className="text-xs text-muted-foreground">
                    Display badge on products
                  </p>
                </div>
                <Switch
                  id="showBadge"
                  checked={showBadge}
                  onCheckedChange={setShowBadge}
                  disabled={isPending}
                />
              </div>

              {showBadge && (
                <div className="space-y-2">
                  <Label htmlFor="badgeText">Badge Text</Label>
                  <Input
                    id="badgeText"
                    value={badgeText}
                    onChange={(e) => {
                      setBadgeTextManuallyEdited(true);
                      setBadgeText(e.target.value);
                    }}
                    placeholder="e.g., 20% OFF"
                    disabled={isPending}
                    maxLength={50}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {discountValue && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-3">
                  <div className="font-semibold text-lg">
                    {name || "Campaign Name"}
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {discountType === "percentage"
                      ? `${discountValue}% OFF`
                      : `${formatPrice(parseFloat(discountValue) || 0, currency)} OFF`}
                  </div>
                  {showBadge && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Product badge:
                      </p>
                      <Badge className="bg-red-500 text-white">
                        {badgeText || `${discountValue}% OFF`}
                      </Badge>
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
              "Update Campaign"
            ) : (
              "Create Campaign"
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
