"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { PriceTier } from "@/lib/db/schema";

export interface PriceTierInput {
  id?: string;
  tempId?: string;
  minQuantity: number;
  maxQuantity: number | null;
  price: string;
}

interface PriceTiersEditorProps {
  tiers: PriceTierInput[];
  onChange: (tiers: PriceTierInput[]) => void;
  basePrice: string;
  currency: string;
  disabled?: boolean;
}

export function PriceTiersEditor({
  tiers,
  onChange,
  basePrice,
  currency,
  disabled = false,
}: PriceTiersEditorProps) {
  const [enabled, setEnabled] = useState(tiers.length > 0);

  // Calculate discount percentage from base price
  const calculateDiscount = (tierPrice: string): number | null => {
    const base = parseFloat(basePrice);
    const tier = parseFloat(tierPrice);
    if (!base || !tier || base <= 0 || tier <= 0 || tier >= base) return null;
    return Math.round(((base - tier) / base) * 100);
  };

  const handleEnableChange = useCallback(
    (checked: boolean) => {
      setEnabled(checked);
      if (!checked) {
        onChange([]);
      }
    },
    [onChange]
  );

  const addTier = useCallback(() => {
    // Find the next logical minQuantity
    let nextMin = 10;
    if (tiers.length > 0) {
      const lastTier = tiers[tiers.length - 1];
      nextMin = (lastTier.maxQuantity ?? lastTier.minQuantity) + 1;
    }

    const newTier: PriceTierInput = {
      tempId: `temp-${Date.now()}`,
      minQuantity: nextMin,
      maxQuantity: null,
      price: "",
    };

    onChange([...tiers, newTier]);
  }, [tiers, onChange]);

  const removeTier = useCallback(
    (index: number) => {
      const newTiers = tiers.filter((_, i) => i !== index);
      onChange(newTiers);
      if (newTiers.length === 0) {
        setEnabled(false);
      }
    },
    [tiers, onChange]
  );

  const updateTier = useCallback(
    (
      index: number,
      field: keyof PriceTierInput,
      value: string | number | null
    ) => {
      const newTiers = [...tiers];
      newTiers[index] = { ...newTiers[index], [field]: value };
      onChange(newTiers);
    },
    [tiers, onChange]
  );

  // Sort tiers by minQuantity for display
  const sortedTiers = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <CardTitle className="text-base">Bulk Pricing</CardTitle>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleEnableChange}
            disabled={disabled}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Offer discounted prices for larger quantities
        </p>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          {/* Tier List */}
          {sortedTiers.length > 0 && (
            <div className="space-y-3">
              {sortedTiers.map((tier, index) => {
                const discount = calculateDiscount(tier.price);
                return (
                  <div
                    key={tier.id || tier.tempId}
                    className="grid grid-cols-12 gap-2 items-end"
                  >
                    {/* Min Quantity */}
                    <div className="col-span-3 space-y-1">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Min
                        </Label>
                      )}
                      <Input
                        type="number"
                        min="1"
                        value={tier.minQuantity}
                        onChange={(e) =>
                          updateTier(
                            index,
                            "minQuantity",
                            parseInt(e.target.value) || 1
                          )
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>

                    {/* Max Quantity */}
                    <div className="col-span-3 space-y-1">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Max
                        </Label>
                      )}
                      <Input
                        type="number"
                        min={tier.minQuantity}
                        value={tier.maxQuantity ?? ""}
                        onChange={(e) =>
                          updateTier(
                            index,
                            "maxQuantity",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="No limit"
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>

                    {/* Tier Price */}
                    <div className="col-span-4 space-y-1">
                      {index === 0 && (
                        <Label className="text-xs text-muted-foreground">
                          Price ({currency})
                        </Label>
                      )}
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.price}
                          onChange={(e) =>
                            updateTier(index, "price", e.target.value)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0.00"
                          disabled={disabled}
                          className="h-9 pr-16"
                        />
                        {discount !== null && (
                          <Badge
                            variant="secondary"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-green-100 text-green-700"
                          >
                            -{discount}%
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTier(index)}
                        disabled={disabled}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Tier Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addTier}
            disabled={disabled}
          >
            <Plus className="mr-2 size-4" />
            Add Price Tier
          </Button>

          {/* Help Text */}
          {tiers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Leave &quot;Max&quot; empty for unlimited quantity. Tiers are
              sorted by minimum quantity automatically.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Transform database PriceTier records to editor format
 */
export function transformDbTiersToEditorFormat(
  dbTiers: PriceTier[]
): PriceTierInput[] {
  return dbTiers.map((tier) => ({
    id: tier.id,
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity,
    price: tier.price,
  }));
}

/**
 * Transform editor format back to database format for saving
 */
export function transformEditorTiersToDbFormat(
  tiers: PriceTierInput[]
): Array<Omit<PriceTierInput, "tempId">> {
  return tiers.map((tier) => ({
    minQuantity: tier.minQuantity,
    maxQuantity: tier.maxQuantity,
    price: tier.price,
  }));
}
