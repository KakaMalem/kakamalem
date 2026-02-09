"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  Save,
  X,
  Truck,
  Zap,
  Store,
  Package,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  createUnifiedMethod,
  updateUnifiedMethod,
  deleteUnifiedMethod,
  replaceWeightTiers,
  type UnifiedMethodWithTiers,
  type UnifiedZone,
} from "@/lib/actions/unified-delivery";
import type {
  DeliveryMethodType,
  RateCalculationType,
} from "@/lib/validations/unified-delivery";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MethodType {
  type: DeliveryMethodType;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const METHOD_TYPES: MethodType[] = [
  {
    type: "local_delivery",
    icon: <Truck className="h-5 w-5" />,
    title: "Local Delivery",
    description: "Same-day or fast local delivery",
  },
  {
    type: "standard",
    icon: <Package className="h-5 w-5" />,
    title: "Standard Shipping",
    description: "Regular shipping (3-7 days)",
  },
  {
    type: "express",
    icon: <Zap className="h-5 w-5" />,
    title: "Express Shipping",
    description: "Priority shipping (1-2 days)",
  },
  {
    type: "pickup",
    icon: <Store className="h-5 w-5" />,
    title: "Store Pickup",
    description: "Customer collects from store",
  },
  {
    type: "custom",
    icon: <Settings2 className="h-5 w-5" />,
    title: "Custom",
    description: "Custom delivery method",
  },
];

const RATE_TYPES: {
  type: RateCalculationType;
  label: string;
  description: string;
}[] = [
  {
    type: "flat",
    label: "Flat Rate",
    description: "Fixed rate for all orders",
  },
  { type: "free", label: "Free", description: "Always free shipping" },
  {
    type: "per_item",
    label: "Per Item",
    description: "Base rate + per item fee",
  },
  {
    type: "weight_based",
    label: "Weight Based",
    description: "Rate based on order weight",
  },
  {
    type: "weight_tiered",
    label: "Weight Tiers",
    description: "Different rates for weight ranges",
  },
  {
    type: "price_based",
    label: "Price Based",
    description: "Free above threshold, else flat rate",
  },
];

interface WeightTier {
  minWeight: number;
  maxWeight: number | null;
  rate: number;
}

interface MethodEditorProps {
  tenantId: string;
  zone: UnifiedZone;
  method?: UnifiedMethodWithTiers | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MethodEditor({
  tenantId,
  zone,
  method,
  open,
  onOpenChange,
  onSuccess,
}: MethodEditorProps) {
  const isEditing = !!method;
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form state
  const [methodType, setMethodType] = useState<DeliveryMethodType>(
    (method?.methodType as DeliveryMethodType) || "standard"
  );
  const [name, setName] = useState(method?.name || "");
  const [description, setDescription] = useState(method?.description || "");

  // Time estimates
  const [minDeliveryDays, setMinDeliveryDays] = useState<number | undefined>(
    method?.minDeliveryDays ?? undefined
  );
  const [maxDeliveryDays, setMaxDeliveryDays] = useState<number | undefined>(
    method?.maxDeliveryDays ?? undefined
  );
  const [estimatedTime, setEstimatedTime] = useState(
    method?.estimatedTime || ""
  );

  // Rate configuration
  const [rateType, setRateType] = useState<RateCalculationType>(
    (method?.rateType as RateCalculationType) || "flat"
  );
  const [baseRate, setBaseRate] = useState(
    method?.baseRate ? parseFloat(method.baseRate) : 0
  );
  const [perItemRate, setPerItemRate] = useState(
    method?.perItemRate ? parseFloat(method.perItemRate) : 0
  );
  const [perKgRate, setPerKgRate] = useState(
    method?.perKgRate ? parseFloat(method.perKgRate) : 0
  );
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    method?.freeShippingThreshold ? parseFloat(method.freeShippingThreshold) : 0
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    method?.minOrderAmount ? parseFloat(method.minOrderAmount) : 0
  );

  // Weight tiers (for weight_tiered rate type)
  const [weightTiers, setWeightTiers] = useState<WeightTier[]>(
    method?.weightTiers?.map((t) => ({
      minWeight: parseFloat(t.minWeight),
      maxWeight: t.maxWeight ? parseFloat(t.maxWeight) : null,
      rate: parseFloat(t.rate),
    })) || [{ minWeight: 0, maxWeight: 5, rate: 100 }]
  );

  // Pickup location (for pickup type)
  const [pickupLocationName, setPickupLocationName] = useState(
    method?.pickupLocationName || ""
  );
  const [pickupLocationAddress, setPickupLocationAddress] = useState(
    method?.pickupLocationAddress || ""
  );

  // Options
  const [includesTracking, setIncludesTracking] = useState(
    method?.includesTracking ?? true
  );
  const [includesInsurance, setIncludesInsurance] = useState(
    method?.includesInsurance ?? false
  );
  const [isActive, setIsActive] = useState(method?.isActive ?? true);

  // Generate default name based on method type
  const getDefaultName = (type: DeliveryMethodType) => {
    const methodInfo = METHOD_TYPES.find((m) => m.type === type);
    return methodInfo?.title || "Delivery";
  };

  // Add weight tier
  const addWeightTier = () => {
    const lastTier = weightTiers[weightTiers.length - 1];
    const newMin = lastTier?.maxWeight ?? 0;
    setWeightTiers([
      ...weightTiers,
      { minWeight: newMin, maxWeight: newMin + 5, rate: 0 },
    ]);
  };

  // Remove weight tier
  const removeWeightTier = (index: number) => {
    setWeightTiers(weightTiers.filter((_, i) => i !== index));
  };

  // Update weight tier
  const updateWeightTier = (
    index: number,
    field: keyof WeightTier,
    value: number | null
  ) => {
    const updated = [...weightTiers];
    updated[index] = { ...updated[index], [field]: value };
    setWeightTiers(updated);
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a method name");
      return;
    }

    startTransition(async () => {
      const input = {
        zoneId: zone.id,
        name,
        description: description || undefined,
        methodType,
        minDeliveryDays: minDeliveryDays || undefined,
        maxDeliveryDays: maxDeliveryDays || undefined,
        estimatedTime: estimatedTime || undefined,
        rateType,
        baseRate,
        perItemRate: rateType === "per_item" ? perItemRate : undefined,
        perKgRate: rateType === "weight_based" ? perKgRate : undefined,
        freeShippingThreshold:
          rateType === "price_based" ? freeShippingThreshold : undefined,
        minOrderAmount: minOrderAmount || undefined,
        handlingFee: 0,
        includesTracking,
        includesInsurance,
        pickupLocationName:
          methodType === "pickup" ? pickupLocationName : undefined,
        pickupLocationAddress:
          methodType === "pickup" ? pickupLocationAddress : undefined,
        displayOrder: 0,
        isActive,
      };

      const result = isEditing
        ? await updateUnifiedMethod(tenantId, method!.id, input)
        : await createUnifiedMethod(tenantId, input);

      if (result.success) {
        // Save weight tiers if using weight_tiered rate type
        if (rateType === "weight_tiered" && result.method) {
          await replaceWeightTiers(tenantId, result.method.id, weightTiers);
        }

        toast.success(isEditing ? "Method updated" : "Method created");
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to save method");
      }
    });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!method) return;

    startTransition(async () => {
      const result = await deleteUnifiedMethod(tenantId, method.id);
      if (result.success) {
        toast.success("Method deleted");
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to delete method");
      }
      setDeleteDialogOpen(false);
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle>
              {isEditing ? "Edit Delivery Method" : "Add Delivery Method"}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Zone: {zone.name}</p>
          </SheetHeader>

          <div className="py-6 space-y-6">
            {/* Method Type */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Method Type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {METHOD_TYPES.map((m) => (
                  <button
                    key={m.type}
                    type="button"
                    className={cn(
                      "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center",
                      methodType === m.type
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => {
                      setMethodType(m.type);
                      if (!name || name === getDefaultName(methodType)) {
                        setName(getDefaultName(m.type));
                      }
                    }}
                    disabled={isPending}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg mb-1",
                        methodType === m.type
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {m.icon}
                    </div>
                    <span className="text-xs font-medium">{m.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Method Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Delivery"
                  disabled={isPending}
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Delivery within 3-5 business days"
                  rows={2}
                  disabled={isPending}
                />
              </div>
            </div>

            <Separator />

            {/* Delivery Time */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Delivery Time Estimate
              </Label>
              {methodType === "local_delivery" ? (
                <div>
                  <Label
                    htmlFor="estimatedTime"
                    className="text-xs text-muted-foreground"
                  >
                    Time estimate (e.g., &ldquo;30-45 minutes&rdquo;)
                  </Label>
                  <Input
                    id="estimatedTime"
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                    placeholder="30-45 minutes"
                    disabled={isPending}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="minDays"
                      className="text-xs text-muted-foreground"
                    >
                      Min days
                    </Label>
                    <Input
                      id="minDays"
                      type="number"
                      min={0}
                      value={minDeliveryDays ?? ""}
                      onChange={(e) =>
                        setMinDeliveryDays(
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      placeholder="3"
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="maxDays"
                      className="text-xs text-muted-foreground"
                    >
                      Max days
                    </Label>
                    <Input
                      id="maxDays"
                      type="number"
                      min={0}
                      value={maxDeliveryDays ?? ""}
                      onChange={(e) =>
                        setMaxDeliveryDays(
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                      placeholder="7"
                      disabled={isPending}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Pricing */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Pricing</Label>

              <div className="space-y-4">
                {/* Rate Type */}
                <div>
                  <Label
                    htmlFor="rateType"
                    className="text-xs text-muted-foreground"
                  >
                    Rate calculation
                  </Label>
                  <Select
                    value={rateType}
                    onValueChange={(v) => setRateType(v as RateCalculationType)}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_TYPES.map((r) => (
                        <SelectItem key={r.type} value={r.type}>
                          <div>
                            <div>{r.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.description}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rate inputs based on type */}
                {rateType === "flat" && (
                  <div>
                    <Label
                      htmlFor="baseRate"
                      className="text-xs text-muted-foreground"
                    >
                      Flat rate (AFN)
                    </Label>
                    <Input
                      id="baseRate"
                      type="number"
                      min={0}
                      value={baseRate}
                      onChange={(e) =>
                        setBaseRate(parseFloat(e.target.value) || 0)
                      }
                      disabled={isPending}
                    />
                  </div>
                )}

                {rateType === "per_item" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Base rate (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={baseRate}
                        onChange={(e) =>
                          setBaseRate(parseFloat(e.target.value) || 0)
                        }
                        disabled={isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Per item (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={perItemRate}
                        onChange={(e) =>
                          setPerItemRate(parseFloat(e.target.value) || 0)
                        }
                        disabled={isPending}
                      />
                    </div>
                  </div>
                )}

                {rateType === "weight_based" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Base rate (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={baseRate}
                        onChange={(e) =>
                          setBaseRate(parseFloat(e.target.value) || 0)
                        }
                        disabled={isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Per kg (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={perKgRate}
                        onChange={(e) =>
                          setPerKgRate(parseFloat(e.target.value) || 0)
                        }
                        disabled={isPending}
                      />
                    </div>
                  </div>
                )}

                {rateType === "price_based" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Rate if below (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={baseRate}
                        onChange={(e) =>
                          setBaseRate(parseFloat(e.target.value) || 0)
                        }
                        disabled={isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Free above (AFN)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={freeShippingThreshold}
                        onChange={(e) =>
                          setFreeShippingThreshold(
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={isPending}
                      />
                    </div>
                  </div>
                )}

                {rateType === "weight_tiered" && (
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      Weight tiers
                    </Label>
                    {weightTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={tier.minWeight}
                          onChange={(e) =>
                            updateWeightTier(
                              idx,
                              "minWeight",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                          className="w-20"
                          disabled={isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          to
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={tier.maxWeight ?? ""}
                          onChange={(e) =>
                            updateWeightTier(
                              idx,
                              "maxWeight",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          placeholder="∞"
                          className="w-20"
                          disabled={isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          kg =
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={tier.rate}
                          onChange={(e) =>
                            updateWeightTier(
                              idx,
                              "rate",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="Rate"
                          className="w-24"
                          disabled={isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          AFN
                        </span>
                        {weightTiers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeWeightTier(idx)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWeightTier}
                      disabled={isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Tier
                    </Button>
                  </div>
                )}

                {/* Min order amount */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Minimum order amount (optional, AFN)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={minOrderAmount || ""}
                    onChange={(e) =>
                      setMinOrderAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="No minimum"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Pickup Location (for pickup type) */}
            {methodType === "pickup" && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    Pickup Location
                  </Label>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Location name
                      </Label>
                      <Input
                        value={pickupLocationName}
                        onChange={(e) => setPickupLocationName(e.target.value)}
                        placeholder="Main Store"
                        disabled={isPending}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Address
                      </Label>
                      <Textarea
                        value={pickupLocationAddress}
                        onChange={(e) =>
                          setPickupLocationAddress(e.target.value)
                        }
                        placeholder="Full address for customers"
                        rows={2}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Includes Tracking</Label>
                  <p className="text-xs text-muted-foreground">
                    Customers can track their delivery
                  </p>
                </div>
                <Switch
                  checked={includesTracking}
                  onCheckedChange={setIncludesTracking}
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Includes Insurance</Label>
                  <p className="text-xs text-muted-foreground">
                    Shipment is insured
                  </p>
                </div>
                <Switch
                  checked={includesInsurance}
                  onCheckedChange={setIncludesInsurance}
                  disabled={isPending}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Show this method to customers
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            {isEditing ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}

            <Button onClick={handleSave} disabled={!name.trim() || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Method"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{method?.name}&rdquo;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
