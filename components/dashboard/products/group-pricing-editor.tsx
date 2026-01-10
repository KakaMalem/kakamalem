"use client";

import { useState, useMemo } from "react";
import { Users, Crown, ShoppingBag, Tag, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CustomerGroup } from "@/lib/db/schema";

export interface GroupPriceInput {
  customerGroupId: string;
  price: string;
  compareAtPrice?: string | null;
}

interface GroupPricingEditorProps {
  customerGroups: CustomerGroup[];
  prices: GroupPriceInput[];
  onChange: (prices: GroupPriceInput[]) => void;
  basePrice: string;
  currency: string;
  disabled?: boolean;
}

const TYPE_ICONS = {
  retail: ShoppingBag,
  wholesale: Tag,
  vip: Crown,
};

/**
 * Calculate discount percentage from base price
 */
function calculateDiscount(
  basePrice: string,
  groupPrice: string
): number | null {
  const base = parseFloat(basePrice);
  const group = parseFloat(groupPrice);

  if (isNaN(base) || isNaN(group) || base <= 0) return null;
  if (group >= base) return null;

  return Math.round(((base - group) / base) * 100);
}

export function GroupPricingEditor({
  customerGroups,
  prices,
  onChange,
  basePrice,
  currency,
  disabled = false,
}: GroupPricingEditorProps) {
  const [enabled, setEnabled] = useState(prices.length > 0);

  // Create a map of group ID to price for easier lookup
  const priceMap = useMemo(() => {
    const map = new Map<string, GroupPriceInput>();
    for (const price of prices) {
      map.set(price.customerGroupId, price);
    }
    return map;
  }, [prices]);

  const handleToggle = (isEnabled: boolean) => {
    setEnabled(isEnabled);
    if (!isEnabled) {
      // Clear all prices when disabling
      onChange([]);
    }
  };

  const handlePriceChange = (groupId: string, newPrice: string) => {
    const existingPrice = priceMap.get(groupId);

    if (!newPrice || newPrice === "") {
      // Remove this group's price if cleared
      onChange(prices.filter((p) => p.customerGroupId !== groupId));
    } else if (existingPrice) {
      // Update existing price
      onChange(
        prices.map((p) =>
          p.customerGroupId === groupId ? { ...p, price: newPrice } : p
        )
      );
    } else {
      // Add new price
      onChange([...prices, { customerGroupId: groupId, price: newPrice }]);
    }
  };

  const handleCompareAtPriceChange = (
    groupId: string,
    newCompareAtPrice: string
  ) => {
    const existingPrice = priceMap.get(groupId);

    if (existingPrice) {
      onChange(
        prices.map((p) =>
          p.customerGroupId === groupId
            ? { ...p, compareAtPrice: newCompareAtPrice || null }
            : p
        )
      );
    }
  };

  if (customerGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Group Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>No customer groups available.</p>
            <p className="mt-1">
              Create customer groups in Settings → Customer Groups to enable
              group-specific pricing.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Group Pricing
          </CardTitle>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={disabled}
          />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set special prices for different customer groups. Leave empty to use
            base price.
          </p>

          <div className="space-y-3">
            {customerGroups.map((group) => {
              const groupPrice = priceMap.get(group.id);
              const TypeIcon =
                TYPE_ICONS[group.type as keyof typeof TYPE_ICONS] || Users;
              const discount = groupPrice?.price
                ? calculateDiscount(basePrice, groupPrice.price)
                : null;

              return (
                <div
                  key={group.id}
                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="size-4 text-muted-foreground" />
                      <span className="font-medium">{group.name}</span>
                      {group.isDefault && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    {discount !== null && (
                      <Badge variant="secondary" className="text-xs">
                        -{discount}%
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Price ({currency})
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={groupPrice?.price || ""}
                        onChange={(e) =>
                          handlePriceChange(group.id, e.target.value)
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={basePrice || "0.00"}
                        disabled={disabled}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        Compare-at
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="size-3" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Original price shown with strikethrough</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={groupPrice?.compareAtPrice || ""}
                        onChange={(e) =>
                          handleCompareAtPriceChange(group.id, e.target.value)
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="Optional"
                        disabled={disabled || !groupPrice?.price}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {group.description && (
                    <p className="text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
