"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Truck,
  Globe,
  Package,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  ShippingZoneInput,
  ShippingMethodInput,
  ShippingRateType,
} from "@/lib/validations/shipping";
import { formatPrice } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

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

interface ShippingManagerProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  initialZones: ShippingZone[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RATE_TYPE_OPTIONS: {
  value: ShippingRateType;
  label: string;
  description: string;
}[] = [
  {
    value: "flat",
    label: "Flat Rate",
    description: "Same price for all orders",
  },
  {
    value: "per_item",
    label: "Per Item",
    description: "Base rate + per item charge",
  },
  {
    value: "weight_based",
    label: "Weight Based",
    description: "Base rate + per kg charge",
  },
  {
    value: "price_based",
    label: "Price Based",
    description: "Free above threshold",
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function ShippingManager({
  tenantId,
  storeSlug,
  currency,
  initialZones,
}: ShippingManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  // Zone form state
  const [zoneForm, setZoneForm] = useState<ShippingZoneInput>({
    name: "",
    description: "",
    countries: [],
    states: [],
    cities: [],
    postalCodes: [],
    priority: 0,
    isActive: true,
  });

  // Method form state
  const [methodForm, setMethodForm] = useState<ShippingMethodInput>({
    zoneId: "",
    name: "",
    description: "",
    minDeliveryDays: null,
    maxDeliveryDays: null,
    rateType: "flat",
    baseRate: "0",
    perItemRate: null,
    perKgRate: null,
    freeShippingThreshold: null,
    minWeight: null,
    maxWeight: null,
    handlingFee: null,
    includesInsurance: false,
    insuranceRate: null,
    includesTracking: true,
    displayOrder: 0,
    isActive: true,
  });

  // Expanded zones tracking
  const [expandedZones, setExpandedZones] = useState<Set<string>>(
    new Set(initialZones.slice(0, 1).map((z) => z.id))
  );

  // ===========================================================================
  // ZONE HANDLERS
  // ===========================================================================

  const resetZoneForm = () => {
    setZoneForm({
      name: "",
      description: "",
      countries: [],
      states: [],
      cities: [],
      postalCodes: [],
      priority: 0,
      isActive: true,
    });
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
      countries: zone.countries || [],
      states: zone.states || [],
      cities: zone.cities || [],
      postalCodes: zone.postalCodes || [],
      priority: zone.priority,
      isActive: zone.isActive,
    });
    setZoneDialogOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    if (editingZone) {
      const result = await updateShippingZoneAction(
        tenantId,
        storeSlug,
        editingZone.id,
        zoneForm
      );
      if (result.success) {
        toast.success("Zone updated");
        setZoneDialogOpen(false);
        resetZoneForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to update zone");
      }
    } else {
      const result = await createShippingZoneAction(
        tenantId,
        storeSlug,
        zoneForm
      );
      if (result.success) {
        toast.success("Zone created");
        setZoneDialogOpen(false);
        resetZoneForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to create zone");
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
      toast.success("Zone deleted");
      setDeleteZoneDialogOpen(false);
      setZoneToDelete(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete zone");
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
      toast.success(zone.isActive ? "Zone disabled" : "Zone enabled");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update zone");
    }
  };

  // ===========================================================================
  // METHOD HANDLERS
  // ===========================================================================

  const resetMethodForm = () => {
    setMethodForm({
      zoneId: "",
      name: "",
      description: "",
      minDeliveryDays: null,
      maxDeliveryDays: null,
      rateType: "flat",
      baseRate: "0",
      perItemRate: null,
      perKgRate: null,
      freeShippingThreshold: null,
      minWeight: null,
      maxWeight: null,
      handlingFee: null,
      includesInsurance: false,
      insuranceRate: null,
      includesTracking: true,
      displayOrder: 0,
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
      minDeliveryDays: method.minDeliveryDays,
      maxDeliveryDays: method.maxDeliveryDays,
      rateType: method.rateType,
      baseRate: method.baseRate,
      perItemRate: method.perItemRate,
      perKgRate: method.perKgRate,
      freeShippingThreshold: method.freeShippingThreshold,
      minWeight: method.minWeight,
      maxWeight: method.maxWeight,
      handlingFee: method.handlingFee,
      includesInsurance: method.includesInsurance,
      insuranceRate: method.insuranceRate,
      includesTracking: method.includesTracking,
      displayOrder: method.displayOrder,
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
      toast.error("Zone is required");
      return;
    }

    if (editingMethod) {
      const result = await updateShippingMethodAction(
        tenantId,
        storeSlug,
        editingMethod.id,
        methodForm
      );
      if (result.success) {
        toast.success("Method updated");
        setMethodDialogOpen(false);
        resetMethodForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to update method");
      }
    } else {
      const result = await createShippingMethodAction(
        tenantId,
        storeSlug,
        methodForm
      );
      if (result.success) {
        toast.success("Method created");
        setMethodDialogOpen(false);
        resetMethodForm();
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error?.message || "Failed to create method");
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
      toast.success("Method deleted");
      setDeleteMethodDialogOpen(false);
      setMethodToDelete(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete method");
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
      toast.success(method.isActive ? "Method disabled" : "Method enabled");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update method");
    }
  };

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

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

  const formatDeliveryTime = (min: number | null, max: number | null) => {
    if (min === null && max === null) return "Not specified";
    if (min === max) return `${min} day${min === 1 ? "" : "s"}`;
    if (min === null) return `Up to ${max} days`;
    if (max === null) return `${min}+ days`;
    return `${min}-${max} days`;
  };

  const getRateDescription = (method: ShippingMethod) => {
    const base = formatPrice(parseFloat(method.baseRate), currency);

    switch (method.rateType) {
      case "flat":
        return base;
      case "per_item":
        const perItem = method.perItemRate
          ? formatPrice(parseFloat(method.perItemRate), currency)
          : "0";
        return `${base} + ${perItem}/item`;
      case "weight_based":
        const perKg = method.perKgRate
          ? formatPrice(parseFloat(method.perKgRate), currency)
          : "0";
        return `${base} + ${perKg}/kg`;
      case "price_based":
        const threshold = method.freeShippingThreshold
          ? formatPrice(parseFloat(method.freeShippingThreshold), currency)
          : "0";
        return `Free over ${threshold}`;
      default:
        return base;
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <>
      <div className="space-y-4">
        {/* Add Zone Button */}
        <div className="flex justify-end">
          <Button onClick={openCreateZoneDialog}>
            <Plus className="mr-2 size-4" />
            Add Shipping Zone
          </Button>
        </div>

        {/* Empty State */}
        {initialZones.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Globe className="mb-4 size-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No shipping zones yet
              </h3>
              <p className="mb-4 max-w-md text-center text-muted-foreground">
                Create shipping zones to define where you deliver and set up
                delivery methods with pricing for each zone.
              </p>
              <Button onClick={openCreateZoneDialog}>
                <Plus className="mr-2 size-4" />
                Create your first zone
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Zones List */
          <div className="space-y-4">
            {initialZones.map((zone) => (
              <Card
                key={zone.id}
                className={!zone.isActive ? "opacity-60" : ""}
              >
                <Collapsible
                  open={expandedZones.has(zone.id)}
                  onOpenChange={() => toggleZoneExpanded(zone.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-left hover:text-primary">
                          {expandedZones.has(zone.id) ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <MapPin className="size-4" />
                              {zone.name}
                              {!zone.isActive && (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </CardTitle>
                            {zone.description && (
                              <CardDescription className="mt-1">
                                {zone.description}
                              </CardDescription>
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {zone.methods.length} method
                          {zone.methods.length !== 1 ? "s" : ""}
                        </Badge>
                        <Badge variant="outline">
                          Priority: {zone.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleZone(zone)}
                          title={zone.isActive ? "Disable zone" : "Enable zone"}
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
                          onClick={() => openEditZoneDialog(zone)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setZoneToDelete(zone);
                            setDeleteZoneDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Shipping Methods */}
                      <div className="space-y-3">
                        {zone.methods.length === 0 ? (
                          <div className="rounded-lg border border-dashed p-6 text-center">
                            <Truck className="mx-auto mb-2 size-8 text-muted-foreground" />
                            <p className="mb-3 text-sm text-muted-foreground">
                              No delivery methods in this zone yet
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCreateMethodDialog(zone.id)}
                            >
                              <Plus className="mr-2 size-4" />
                              Add Method
                            </Button>
                          </div>
                        ) : (
                          <>
                            {zone.methods.map((method) => (
                              <div
                                key={method.id}
                                className={`flex items-center justify-between rounded-lg border p-4 ${
                                  !method.isActive ? "opacity-60" : ""
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <Package className="size-5 text-muted-foreground" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {method.name}
                                      </span>
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
                                      <p className="text-sm text-muted-foreground">
                                        {method.description}
                                      </p>
                                    )}
                                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                                      <span>{getRateDescription(method)}</span>
                                      <span className="text-xs">|</span>
                                      <span>
                                        {formatDeliveryTime(
                                          method.minDeliveryDays,
                                          method.maxDeliveryDays
                                        )}
                                      </span>
                                      {method.includesTracking && (
                                        <>
                                          <span className="text-xs">|</span>
                                          <span>Tracking</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleMethod(method)}
                                    title={
                                      method.isActive
                                        ? "Disable method"
                                        : "Enable method"
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
                                    onClick={() => openEditMethodDialog(method)}
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
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => openCreateMethodDialog(zone.id)}
                            >
                              <Plus className="mr-2 size-4" />
                              Add Another Method
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Zone Dialog */}
      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Edit Shipping Zone" : "Create Shipping Zone"}
            </DialogTitle>
            <DialogDescription>
              {editingZone
                ? "Update the shipping zone details."
                : "Create a new shipping zone to define where you deliver."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="zoneName">Zone Name *</Label>
              <Input
                id="zoneName"
                value={zoneForm.name}
                onChange={(e) =>
                  setZoneForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Kabul City, Afghanistan, International"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoneDescription">Description</Label>
              <Textarea
                id="zoneDescription"
                value={zoneForm.description || ""}
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description of this zone"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zonePriority">Priority</Label>
                <Input
                  id="zonePriority"
                  type="number"
                  min="0"
                  value={zoneForm.priority}
                  onChange={(e) =>
                    setZoneForm((prev) => ({
                      ...prev,
                      priority: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority zones are checked first
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={zoneForm.isActive}
                    onCheckedChange={(checked) =>
                      setZoneForm((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span className="text-sm">
                    {zoneForm.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Leave geographic filters empty to create a
                catch-all zone that matches all addresses. The system uses GPS
                coordinates for delivery, so zones without filters will accept
                all locations.
              </p>
            </div>
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
              {editingZone ? "Save Changes" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Method Dialog */}
      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? "Edit Delivery Method" : "Add Delivery Method"}
            </DialogTitle>
            <DialogDescription>
              {editingMethod
                ? "Update the delivery method details."
                : "Add a new delivery method to this zone."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="methodName">Method Name *</Label>
              <Input
                id="methodName"
                value={methodForm.name}
                onChange={(e) =>
                  setMethodForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Standard Delivery, Express, Same Day"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="methodDescription">Description</Label>
              <Textarea
                id="methodDescription"
                value={methodForm.description || ""}
                onChange={(e) =>
                  setMethodForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description shown to customers"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minDays">Min Delivery Days</Label>
                <Input
                  id="minDays"
                  type="number"
                  min="0"
                  value={methodForm.minDeliveryDays ?? ""}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      minDeliveryDays: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="e.g., 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxDays">Max Delivery Days</Label>
                <Input
                  id="maxDays"
                  type="number"
                  min="0"
                  value={methodForm.maxDeliveryDays ?? ""}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      maxDeliveryDays: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="e.g., 3"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateType">Rate Type</Label>
              <Select
                value={methodForm.rateType}
                onValueChange={(value: ShippingRateType) =>
                  setMethodForm((prev) => ({ ...prev, rateType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div>{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseRate">Base Rate ({currency})</Label>
              <Input
                id="baseRate"
                type="number"
                min="0"
                step="0.01"
                value={methodForm.baseRate}
                onChange={(e) =>
                  setMethodForm((prev) => ({
                    ...prev,
                    baseRate: e.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            {methodForm.rateType === "per_item" && (
              <div className="space-y-2">
                <Label htmlFor="perItemRate">Per Item Rate ({currency})</Label>
                <Input
                  id="perItemRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={methodForm.perItemRate || ""}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      perItemRate: e.target.value || null,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            )}

            {methodForm.rateType === "weight_based" && (
              <div className="space-y-2">
                <Label htmlFor="perKgRate">Per Kg Rate ({currency})</Label>
                <Input
                  id="perKgRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={methodForm.perKgRate || ""}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      perKgRate: e.target.value || null,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
            )}

            {methodForm.rateType === "price_based" && (
              <div className="space-y-2">
                <Label htmlFor="freeThreshold">
                  Free Shipping Threshold ({currency})
                </Label>
                <Input
                  id="freeThreshold"
                  type="number"
                  min="0"
                  step="0.01"
                  value={methodForm.freeShippingThreshold || ""}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      freeShippingThreshold: e.target.value || null,
                    }))
                  }
                  placeholder="e.g., 1000"
                />
                <p className="text-xs text-muted-foreground">
                  Orders above this amount get free shipping
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="handlingFee">Handling Fee ({currency})</Label>
              <Input
                id="handlingFee"
                type="number"
                min="0"
                step="0.01"
                value={methodForm.handlingFee || ""}
                onChange={(e) =>
                  setMethodForm((prev) => ({
                    ...prev,
                    handlingFee: e.target.value || null,
                  }))
                }
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Additional fee added to the shipping cost
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tracking</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={methodForm.includesTracking}
                    onCheckedChange={(checked) =>
                      setMethodForm((prev) => ({
                        ...prev,
                        includesTracking: checked,
                      }))
                    }
                  />
                  <span className="text-sm">Includes tracking</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={methodForm.isActive}
                    onCheckedChange={(checked) =>
                      setMethodForm((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span className="text-sm">
                    {methodForm.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
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
              {editingMethod ? "Save Changes" : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Zone Confirmation */}
      <AlertDialog
        open={deleteZoneDialogOpen}
        onOpenChange={setDeleteZoneDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipping Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{zoneToDelete?.name}&quot;?
              This will also delete all delivery methods in this zone. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteZone}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Method Confirmation */}
      <AlertDialog
        open={deleteMethodDialogOpen}
        onOpenChange={setDeleteMethodDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{methodToDelete?.name}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMethod}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Method
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
