"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Truck,
  Package,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Layers,
  Gift,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  createShippingZoneAction,
  updateShippingZoneAction,
  deleteShippingZoneAction,
  createShippingMethodAction,
  updateShippingMethodAction,
  deleteShippingMethodAction,
  toggleShippingZoneAction,
  toggleShippingMethodAction,
} from "@/lib/actions/shipping";
import type { ShippingRateType } from "@/lib/validations/shipping";
import { formatPrice, cn } from "@/lib/utils";

// Types
type ShippingMethod = {
  id: string;
  tenantId: string;
  zoneId: string;
  name: string;
  description: string | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  rateType: ShippingRateType;
  baseRate: string;
  perItemRate: string | null;
  perKgRate: string | null;
  freeShippingThreshold: string | null;
  minWeight: string | null;
  maxWeight: string | null;
  handlingFee: string | null;
  includesInsurance: boolean;
  insuranceRate: string | null;
  includesTracking: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ShippingZone = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  countries: string[] | null;
  states: string[] | null;
  cities: string[] | null;
  postalCodes: string[] | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  methods: ShippingMethod[];
};

interface ShippingRatesManagerProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  initialZones: ShippingZone[];
}

const RATE_TYPE_OPTIONS: {
  value: ShippingRateType;
  label: string;
  description: string;
  icon: typeof DollarSign;
}[] = [
  {
    value: "flat",
    label: "Flat Rate",
    description: "Same price for all orders",
    icon: DollarSign,
  },
  {
    value: "per_item",
    label: "Per Item",
    description: "Base + charge per item",
    icon: Layers,
  },
];

export function ShippingRatesManager({
  tenantId,
  storeSlug,
  currency,
  initialZones,
}: ShippingRatesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const zones = initialZones;

  // Zone dialog states
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [deleteZoneDialogOpen, setDeleteZoneDialogOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null);

  // Method dialog states
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(
    null
  );
  const [deleteMethodDialogOpen, setDeleteMethodDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<ShippingMethod | null>(
    null
  );

  // Zone form - simplified
  const [zoneForm, setZoneForm] = useState({
    name: "",
    description: "",
  });

  // Method form - simplified
  const [methodForm, setMethodForm] = useState({
    zoneId: "",
    name: "",
    description: "",
    rateType: "flat" as ShippingRateType,
    baseRate: "0",
    perItemRate: null as string | null,
    freeShippingThreshold: null as string | null,
    isActive: true,
  });

  // Expanded zones
  const [expandedZones, setExpandedZones] = useState<Set<string>>(
    new Set(zones.slice(0, 1).map((z) => z.id))
  );

  // Zone handlers
  const resetZoneForm = () => {
    setZoneForm({ name: "", description: "" });
    setEditingZone(null);
  };

  const openCreateZoneDialog = () => {
    resetZoneForm();
    setZoneDialogOpen(true);
  };

  const openEditZoneDialog = (zone: ShippingZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || "",
    });
    setZoneDialogOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast.error("Rate group name is required");
      return;
    }

    const zoneData = {
      name: zoneForm.name.trim(),
      description: zoneForm.description,
      countries: [],
      states: [],
      cities: [],
      postalCodes: [],
      priority: 0,
      isActive: true,
    };

    if (editingZone) {
      const result = await updateShippingZoneAction(
        tenantId,
        storeSlug,
        editingZone.id,
        zoneData
      );
      if (result.success) {
        toast.success("Rate group updated");
        setZoneDialogOpen(false);
        resetZoneForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } else {
      const result = await createShippingZoneAction(
        tenantId,
        storeSlug,
        zoneData
      );
      if (result.success) {
        toast.success("Rate group created");
        setZoneDialogOpen(false);
        resetZoneForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to create");
      }
    }
  };

  const handleDeleteZone = async () => {
    if (!zoneToDelete) return;

    const result = await deleteShippingZoneAction(
      tenantId,
      storeSlug,
      zoneToDelete.id
    );
    if (result.success) {
      toast.success("Rate group deleted");
      setDeleteZoneDialogOpen(false);
      setZoneToDelete(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete");
    }
  };

  const handleToggleZone = async (zone: ShippingZone) => {
    const result = await toggleShippingZoneAction(
      tenantId,
      storeSlug,
      zone.id,
      !zone.isActive
    );
    if (result.success) {
      toast.success(
        zone.isActive ? "Rate group disabled" : "Rate group enabled"
      );
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update");
    }
  };

  // Method handlers
  const resetMethodForm = () => {
    setMethodForm({
      zoneId: "",
      name: "",
      description: "",
      rateType: "flat",
      baseRate: "0",
      perItemRate: null,
      freeShippingThreshold: null,
      isActive: true,
    });
    setEditingMethod(null);
  };

  const openCreateMethodDialog = (zoneId: string) => {
    resetMethodForm();
    setMethodForm((prev) => ({ ...prev, zoneId }));
    setMethodDialogOpen(true);
  };

  const openEditMethodDialog = (method: ShippingMethod) => {
    setEditingMethod(method);
    setMethodForm({
      zoneId: method.zoneId,
      name: method.name,
      description: method.description || "",
      rateType: method.rateType,
      baseRate: method.baseRate,
      perItemRate: method.perItemRate,
      freeShippingThreshold: method.freeShippingThreshold,
      isActive: method.isActive,
    });
    setMethodDialogOpen(true);
  };

  const handleSaveMethod = async () => {
    if (!methodForm.name.trim()) {
      toast.error("Method name is required");
      return;
    }

    if (!methodForm.zoneId) {
      toast.error("Rate group is required");
      return;
    }

    const methodData = {
      zoneId: methodForm.zoneId,
      name: methodForm.name.trim(),
      description: methodForm.description,
      minDeliveryDays: null,
      maxDeliveryDays: null,
      rateType: methodForm.rateType,
      baseRate: methodForm.baseRate,
      perItemRate: methodForm.perItemRate,
      perKgRate: null,
      freeShippingThreshold: methodForm.freeShippingThreshold,
      minWeight: null,
      maxWeight: null,
      handlingFee: null,
      includesInsurance: false,
      insuranceRate: null,
      includesTracking: true,
      displayOrder: 0,
      isActive: methodForm.isActive,
    };

    if (editingMethod) {
      const result = await updateShippingMethodAction(
        tenantId,
        storeSlug,
        editingMethod.id,
        methodData
      );
      if (result.success) {
        toast.success("Shipping rate updated");
        setMethodDialogOpen(false);
        resetMethodForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to update");
      }
    } else {
      const result = await createShippingMethodAction(
        tenantId,
        storeSlug,
        methodData
      );
      if (result.success) {
        toast.success("Shipping rate created");
        setMethodDialogOpen(false);
        resetMethodForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to create");
      }
    }
  };

  const handleDeleteMethod = async () => {
    if (!methodToDelete) return;

    const result = await deleteShippingMethodAction(
      tenantId,
      storeSlug,
      methodToDelete.id
    );
    if (result.success) {
      toast.success("Shipping rate deleted");
      setDeleteMethodDialogOpen(false);
      setMethodToDelete(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete");
    }
  };

  const handleToggleMethod = async (method: ShippingMethod) => {
    const result = await toggleShippingMethodAction(
      tenantId,
      storeSlug,
      method.id,
      !method.isActive
    );
    if (result.success) {
      toast.success(method.isActive ? "Rate disabled" : "Rate enabled");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update");
    }
  };

  // Helpers
  const toggleZoneExpanded = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  const getRateDescription = (method: ShippingMethod) => {
    const baseValue = parseFloat(method.baseRate);
    const base = formatPrice(baseValue, currency);
    const threshold = method.freeShippingThreshold
      ? parseFloat(method.freeShippingThreshold)
      : 0;

    let rateText = "";

    switch (method.rateType) {
      case "flat":
        rateText = baseValue === 0 ? "Free" : base;
        break;
      case "per_item":
        const perItem = method.perItemRate
          ? formatPrice(parseFloat(method.perItemRate), currency)
          : formatPrice(0, currency);
        rateText = `${base} + ${perItem}/item`;
        break;
      case "price_based":
        // Legacy support - treat as flat with threshold
        rateText = baseValue === 0 ? "Free" : base;
        break;
      default:
        rateText = base;
    }

    // Add free shipping threshold info if set
    if (threshold > 0 && baseValue > 0) {
      return `${rateText} (free over ${formatPrice(threshold, currency)})`;
    }

    return rateText;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Empty State */}
        {zones.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <Truck className="size-7 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                Set up shipping rates
              </h3>
              <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                Create rate groups to organize your shipping options. Each group
                can have multiple pricing methods (flat rate, per item, or
                price-based).
              </p>
              <Button onClick={openCreateZoneDialog}>
                <Plus className="mr-2 size-4" />
                Create Rate Group
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {zones.length} rate group{zones.length !== 1 ? "s" : ""}{" "}
                configured
              </p>
              <Button onClick={openCreateZoneDialog} size="sm">
                <Plus className="mr-2 size-4" />
                Add Group
              </Button>
            </div>

            {/* Rate Groups List */}
            <div className="space-y-4">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={cn(
                    "rounded-lg border bg-card",
                    !zone.isActive && "opacity-60"
                  )}
                >
                  <Collapsible
                    open={expandedZones.has(zone.id)}
                    onOpenChange={() => toggleZoneExpanded(zone.id)}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-left hover:text-primary">
                          {expandedZones.has(zone.id) ? (
                            <ChevronDown className="size-4 shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0" />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{zone.name}</span>
                            {!zone.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Disabled
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {zone.methods.length} rate
                              {zone.methods.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleToggleZone(zone)}
                          title={zone.isActive ? "Disable" : "Enable"}
                        >
                          {zone.isActive ? (
                            <ToggleRight className="size-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditZoneDialog(zone)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setZoneToDelete(zone);
                            setDeleteZoneDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="px-4 pb-4">
                        <div className="space-y-3">
                          {zone.methods.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center">
                              <Package className="mx-auto mb-2 size-8 text-muted-foreground" />
                              <p className="mb-3 text-sm text-muted-foreground">
                                No shipping rates in this group yet
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateMethodDialog(zone.id)}
                              >
                                <Plus className="mr-2 size-4" />
                                Add Rate
                              </Button>
                            </div>
                          ) : (
                            <>
                              {zone.methods.map((method) => {
                                const rateTypeConfig = RATE_TYPE_OPTIONS.find(
                                  (o) => o.value === method.rateType
                                );
                                const RateIcon =
                                  rateTypeConfig?.icon || DollarSign;

                                return (
                                  <div
                                    key={method.id}
                                    className={cn(
                                      "flex items-center justify-between rounded-lg border p-4 transition-colors",
                                      "hover:bg-muted/30",
                                      !method.isActive &&
                                        "opacity-60 bg-muted/20"
                                    )}
                                  >
                                    <div className="flex items-center gap-4 min-w-0">
                                      <div
                                        className={cn(
                                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                          method.isActive
                                            ? "bg-primary/10"
                                            : "bg-muted"
                                        )}
                                      >
                                        <RateIcon
                                          className={cn(
                                            "h-4 w-4",
                                            method.isActive
                                              ? "text-primary"
                                              : "text-muted-foreground"
                                          )}
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium">
                                            {method.name}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="text-xs font-normal"
                                          >
                                            {rateTypeConfig?.label ||
                                              method.rateType}
                                          </Badge>
                                          {!method.isActive && (
                                            <Badge
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              Disabled
                                            </Badge>
                                          )}
                                        </div>
                                        {method.description && (
                                          <p className="text-sm text-muted-foreground truncate max-w-md">
                                            {method.description}
                                          </p>
                                        )}
                                        <div className="mt-1 text-sm font-semibold text-primary">
                                          {getRateDescription(method)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-4">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          handleToggleMethod(method)
                                        }
                                        title={
                                          method.isActive ? "Disable" : "Enable"
                                        }
                                      >
                                        {method.isActive ? (
                                          <ToggleRight className="size-4 text-green-600" />
                                        ) : (
                                          <ToggleLeft className="size-4" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          openEditMethodDialog(method)
                                        }
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setMethodToDelete(method);
                                          setDeleteMethodDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="size-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => openCreateMethodDialog(zone.id)}
                              >
                                <Plus className="mr-2 size-4" />
                                Add Another Rate
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Edit Rate Group" : "Create Rate Group"}
            </DialogTitle>
            <DialogDescription>
              {editingZone
                ? "Update the rate group details."
                : "Groups help organize your shipping rates. You'll add specific rates after creating the group."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="zoneName">Group Name *</Label>
              <Input
                id="zoneName"
                value={zoneForm.name}
                onChange={(e) =>
                  setZoneForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Standard Delivery, Express Options"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoneDescription">Description</Label>
              <Textarea
                id="zoneDescription"
                value={zoneForm.description}
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Internal note (not shown to customers)"
                rows={2}
              />
            </div>

            {/* Quick Fill Options - only for new zones */}
            {!editingZone && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Quick fill</Label>
                <div className="flex flex-wrap gap-2">
                  {["Standard Delivery", "Express Options", "Local Pickup"].map(
                    (name) => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() =>
                          setZoneForm((prev) => ({ ...prev, name }))
                        }
                      >
                        {name}
                      </Button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setZoneDialogOpen(false);
                resetZoneForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveZone} disabled={isPending}>
              {editingZone ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Method Dialog */}
      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? "Edit Shipping Rate" : "Add Shipping Rate"}
            </DialogTitle>
            <DialogDescription>
              Configure how shipping is calculated for this option.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 overflow-y-auto flex-1 pr-1">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="methodName">Name *</Label>
                <Input
                  id="methodName"
                  value={methodForm.name}
                  onChange={(e) =>
                    setMethodForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Standard Delivery, Express"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="methodDescription">Description</Label>
                <Textarea
                  id="methodDescription"
                  value={methodForm.description}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Shown to customers at checkout"
                  rows={2}
                />
              </div>
            </div>

            {/* Rate Type */}
            <div className="space-y-3">
              <Label>Pricing Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {RATE_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = methodForm.rateType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setMethodForm((prev) => ({
                          ...prev,
                          rateType: option.value,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-all text-left",
                        "hover:border-primary/50 hover:bg-muted/50",
                        isSelected &&
                          "border-primary bg-primary/5 ring-1 ring-primary"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Fields */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              {/* Base Rate */}
              <div className="space-y-2">
                <Label htmlFor="baseRate">
                  {methodForm.rateType === "per_item"
                    ? "Base Rate"
                    : "Shipping Rate"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currency}
                  </span>
                  <Input
                    id="baseRate"
                    type="number"
                    min="0"
                    step="10"
                    value={methodForm.baseRate}
                    onChange={(e) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        baseRate: e.target.value,
                      }))
                    }
                    onWheel={(e) => e.currentTarget.blur()}
                    className="pl-12"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Per Item Rate */}
              {methodForm.rateType === "per_item" && (
                <div className="space-y-2">
                  <Label htmlFor="perItemRate">Per Item</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      id="perItemRate"
                      type="number"
                      min="0"
                      step="10"
                      value={methodForm.perItemRate || ""}
                      onChange={(e) =>
                        setMethodForm((prev) => ({
                          ...prev,
                          perItemRate: e.target.value || null,
                        }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="pl-12"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Free Shipping Threshold - available for all types */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="enableFreeThreshold"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Gift className="h-4 w-4 text-green-600" />
                    Free shipping above
                  </Label>
                  <Switch
                    id="enableFreeThreshold"
                    checked={!!methodForm.freeShippingThreshold}
                    onCheckedChange={(checked) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        freeShippingThreshold: checked ? "1000" : null,
                      }))
                    }
                  />
                </div>
                {methodForm.freeShippingThreshold && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      id="freeThreshold"
                      type="number"
                      min="0"
                      step="100"
                      value={methodForm.freeShippingThreshold}
                      onChange={(e) =>
                        setMethodForm((prev) => ({
                          ...prev,
                          freeShippingThreshold: e.target.value || null,
                        }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="pl-12"
                      placeholder="e.g., 1000"
                    />
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="rounded-md bg-background p-2.5 border mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Preview:</span>
                  <span className="font-semibold text-primary">
                    {(() => {
                      const base = parseFloat(methodForm.baseRate) || 0;
                      const threshold =
                        parseFloat(methodForm.freeShippingThreshold || "0") ||
                        0;

                      if (methodForm.rateType === "flat") {
                        if (threshold > 0) {
                          return base === 0
                            ? "Free"
                            : `Free over ${formatPrice(threshold, currency)}`;
                        }
                        return base === 0
                          ? "Free"
                          : formatPrice(base, currency);
                      }
                      if (methodForm.rateType === "per_item") {
                        const perItem =
                          parseFloat(methodForm.perItemRate || "0") || 0;
                        const rateText =
                          base === 0 && perItem === 0
                            ? "Free"
                            : `${formatPrice(base, currency)} + ${formatPrice(perItem, currency)}/item`;
                        if (threshold > 0) {
                          return `${rateText} (free over ${formatPrice(threshold, currency)})`;
                        }
                        return rateText;
                      }
                      return formatPrice(base, currency);
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-sm font-medium">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  {methodForm.isActive ? "Visible to customers" : "Hidden"}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={methodForm.isActive}
                onCheckedChange={(checked) =>
                  setMethodForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setMethodDialogOpen(false);
                resetMethodForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMethod} disabled={isPending}>
              {editingMethod ? "Save Changes" : "Add Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <AlertDialog
        open={deleteZoneDialogOpen}
        onOpenChange={setDeleteZoneDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{zoneToDelete?.name}&quot;?
              This will also delete all shipping rates in this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteZone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteMethodDialogOpen}
        onOpenChange={setDeleteMethodDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipping Rate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{methodToDelete?.name}
              &quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMethod}
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
