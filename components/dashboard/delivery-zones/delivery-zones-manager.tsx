"use client";

import {
  useState,
  useTransition,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  CircleDot,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  toggleDeliveryZoneStatus,
} from "@/lib/actions/delivery-zones";
import { formatRadius } from "@/lib/geo/delivery-zone-check";
import { formatPrice, cn } from "@/lib/utils";
import type { DeliveryZone } from "@/lib/db/schema";

// Dynamically import the map component to avoid SSR issues
const DeliveryZoneMap = dynamic(
  () => import("./delivery-zone-map").then((mod) => mod.DeliveryZoneMapWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-100 rounded-lg border bg-muted animate-pulse flex items-center justify-center">
        <MapPin className="h-8 w-8 text-muted-foreground" />
      </div>
    ),
  }
);

type DeliveryZonesManagerProps = {
  tenantId: string;
  currency: string;
  initialZones: DeliveryZone[];
  /** Store's physical location - used as default center for new zones */
  storeLocation?: { lat: number; lng: number } | null;
};

type ZoneFormData = {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  deliveryFee: number;
  minOrderAmount: number | null;
  freeShippingThreshold: number | null;
  estimatedDeliveryTime: string;
  isActive: boolean;
  color: string;
};

// Fallback center (Kabul) if GPS and IP location both fail
const FALLBACK_CENTER = { lat: 34.5553, lng: 69.2075 };

// Fetch approximate location from IP
async function getIPLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch("http://ip-api.com/json/?fields=lat,lon", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.lat && data.lon) {
      return { lat: data.lat, lng: data.lon };
    }
    return null;
  } catch {
    return null;
  }
}

const ZONE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

const DEFAULT_ZONE: ZoneFormData = {
  name: "",
  centerLat: FALLBACK_CENTER.lat,
  centerLng: FALLBACK_CENTER.lng,
  radiusMeters: 3000,
  deliveryFee: 0,
  minOrderAmount: null,
  freeShippingThreshold: null,
  estimatedDeliveryTime: "",
  isActive: true,
  color: "#3b82f6",
};

export function DeliveryZonesManager({
  tenantId,
  currency,
  initialZones,
  storeLocation,
}: DeliveryZonesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Use initialZones directly - router.refresh() will re-render parent with fresh data
  const zones = initialZones;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>(DEFAULT_ZONE);

  // Dynamic default center: store location > GPS > IP > fallback
  const [defaultCenter, setDefaultCenter] = useState(
    storeLocation || FALLBACK_CENTER
  );

  // Fetch user's location on mount if no store location (GPS if allowed, otherwise IP)
  useEffect(() => {
    // If store location is set, it's already used as initial state - skip GPS/IP lookup
    if (storeLocation) {
      return;
    }

    let cancelled = false;

    async function initializeDefaultLocation() {
      // First, try GPS if permission is already granted
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({
            name: "geolocation",
          });
          if (status.state === "granted") {
            const position = await new Promise<GeolocationPosition>(
              (resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: false,
                  timeout: 5000,
                  maximumAge: 300000,
                });
              }
            );
            if (!cancelled) {
              setDefaultCenter({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              return;
            }
          }
        } catch {
          // Permission API not supported or GPS failed, continue to IP
        }
      }

      // Fall back to IP geolocation
      const ipLocation = await getIPLocation();
      if (!cancelled && ipLocation) {
        setDefaultCenter(ipLocation);
      }
    }

    initializeDefaultLocation();

    return () => {
      cancelled = true;
    };
  }, [storeLocation]);

  // Get the next available color
  const getNextColor = useCallback(() => {
    const usedColors = zones.map((z) => z.color);
    const availableColor = ZONE_COLORS.find((c) => !usedColors.includes(c));
    return availableColor || ZONE_COLORS[zones.length % ZONE_COLORS.length];
  }, [zones]);

  // Create form data from existing zone
  const zoneToFormData = useCallback((zone: DeliveryZone): ZoneFormData => {
    return {
      name: zone.name,
      centerLat: zone.centerLat
        ? parseFloat(zone.centerLat)
        : FALLBACK_CENTER.lat,
      centerLng: zone.centerLng
        ? parseFloat(zone.centerLng)
        : FALLBACK_CENTER.lng,
      radiusMeters: zone.radiusMeters || 3000,
      deliveryFee: parseFloat(zone.deliveryFee),
      minOrderAmount: zone.minOrderAmount
        ? parseFloat(zone.minOrderAmount)
        : null,
      freeShippingThreshold: zone.freeShippingThreshold
        ? parseFloat(zone.freeShippingThreshold)
        : null,
      estimatedDeliveryTime: zone.estimatedDeliveryTime || "",
      isActive: zone.isActive,
      color: zone.color || "#3b82f6",
    };
  }, []);

  // Open dialog for new zone
  const handleCreateNew = useCallback(() => {
    setEditingZone(null);
    setFormData({
      ...DEFAULT_ZONE,
      centerLat: defaultCenter.lat,
      centerLng: defaultCenter.lng,
      color: getNextColor(),
      displayOrder: zones.length,
    } as ZoneFormData);
    setIsDialogOpen(true);
  }, [getNextColor, zones.length, defaultCenter]);

  // Open dialog for editing
  const handleEdit = useCallback(
    (zone: DeliveryZone) => {
      setEditingZone(zone);
      setFormData(zoneToFormData(zone));
      setIsDialogOpen(true);
    },
    [zoneToFormData]
  );

  // Handle map zone changes
  const handleMapZoneChange = useCallback(
    (data: { centerLat: number; centerLng: number; radiusMeters: number }) => {
      setFormData((prev) => ({
        ...prev,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusMeters: data.radiusMeters,
      }));
    },
    []
  );

  // Handle radius slider change
  const handleRadiusChange = useCallback((value: number[]) => {
    setFormData((prev) => ({
      ...prev,
      radiusMeters: value[0],
    }));
  }, []);

  // Submit form
  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      toast.error("Please enter a zone name");
      return;
    }

    startTransition(async () => {
      try {
        const input = {
          name: formData.name.trim(),
          zoneType: "circle" as const,
          centerLat: formData.centerLat,
          centerLng: formData.centerLng,
          radiusMeters: formData.radiusMeters,
          deliveryFee: formData.deliveryFee,
          minOrderAmount: formData.minOrderAmount,
          freeShippingThreshold: formData.freeShippingThreshold,
          estimatedDeliveryTime: formData.estimatedDeliveryTime || null,
          displayOrder: zones.length,
          isActive: formData.isActive,
          color: formData.color,
        };

        if (editingZone) {
          const result = await updateDeliveryZone(
            tenantId,
            editingZone.id,
            input
          );
          if (result.success) {
            toast.success("Delivery zone updated");
            setIsDialogOpen(false);
            router.refresh();
          } else {
            toast.error(result.error?.message || "Failed to update zone");
          }
        } else {
          const result = await createDeliveryZone(tenantId, input);
          if (result.success) {
            toast.success("Delivery zone created");
            setIsDialogOpen(false);
            router.refresh();
          } else {
            toast.error(result.error?.message || "Failed to create zone");
          }
        }
      } catch (error) {
        toast.error("An error occurred");
        console.error(error);
      }
    });
  }, [formData, editingZone, tenantId, zones.length, router]);

  // Toggle zone status
  const handleToggleStatus = useCallback(
    (zone: DeliveryZone) => {
      startTransition(async () => {
        const result = await toggleDeliveryZoneStatus(
          tenantId,
          zone.id,
          !zone.isActive
        );
        if (result.success) {
          toast.success(zone.isActive ? "Zone deactivated" : "Zone activated");
          router.refresh();
        } else {
          toast.error(result.error?.message || "Failed to update zone");
        }
      });
    },
    [tenantId, router]
  );

  // Delete zone
  const handleDelete = useCallback(() => {
    if (!deletingZone) return;

    startTransition(async () => {
      const result = await deleteDeliveryZone(tenantId, deletingZone.id);
      if (result.success) {
        toast.success("Delivery zone deleted");
        setIsDeleteDialogOpen(false);
        setDeletingZone(null);
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to delete zone");
      }
    });
  }, [deletingZone, tenantId, router]);

  // Create a virtual editing zone for the map
  const virtualEditingZone = useMemo(() => {
    if (!isDialogOpen) return null;
    return {
      id: editingZone?.id || "new",
      tenantId,
      name: formData.name,
      zoneType: "circle" as const,
      centerLat: formData.centerLat.toString(),
      centerLng: formData.centerLng.toString(),
      radiusMeters: formData.radiusMeters,
      polygonCoordinates: null,
      deliveryFee: formData.deliveryFee.toString(),
      minOrderAmount: formData.minOrderAmount?.toString() || null,
      freeShippingThreshold: formData.freeShippingThreshold?.toString() || null,
      estimatedDeliveryTime: formData.estimatedDeliveryTime || null,
      displayOrder: 0,
      isActive: true,
      color: formData.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as DeliveryZone;
  }, [isDialogOpen, editingZone, tenantId, formData]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {zones.length} zone{zones.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleCreateNew} size="sm" variant="outline">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      {/* Map Preview */}
      <div className="rounded-lg border overflow-hidden">
        <DeliveryZoneMap zones={zones} editingZone={null} isEditing={false} />
      </div>

      {/* Zones List */}
      {zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
            <MapPin className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No delivery zones yet. Add a zone to define where you deliver.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={cn(
                "flex items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/30",
                !zone.isActive && "opacity-50"
              )}
            >
              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: zone.color || "#3b82f6" }}
              />

              {/* Zone info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate">
                    {zone.name}
                  </span>
                  {!zone.isActive && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1 py-0"
                    >
                      Off
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <CircleDot className="h-3 w-3" />
                    {formatRadius(zone.radiusMeters || 0)}
                  </span>
                  <span>•</span>
                  <span>
                    {parseFloat(zone.deliveryFee) === 0
                      ? "Free"
                      : formatPrice(parseFloat(zone.deliveryFee), currency)}
                  </span>
                  {zone.freeShippingThreshold && (
                    <>
                      <span>•</span>
                      <span className="text-green-600">
                        Free over{" "}
                        {formatPrice(
                          parseFloat(zone.freeShippingThreshold),
                          currency
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleToggleStatus(zone)}
                  disabled={isPending}
                >
                  {zone.isActive ? (
                    <ToggleRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleEdit(zone)}
                  disabled={isPending}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => {
                    setDeletingZone(zone);
                    setIsDeleteDialogOpen(true);
                  }}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingZone ? "Edit Delivery Zone" : "Create Delivery Zone"}
            </DialogTitle>
            <DialogDescription>
              Click on the map to set the center point, then adjust the radius.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Map */}
            <div>
              <Label className="mb-2 block">Zone Location & Radius</Label>
              <DeliveryZoneMap
                zones={zones}
                editingZone={virtualEditingZone}
                onZoneChange={handleMapZoneChange}
                isEditing={true}
                className="h-75 "
              />
              <p className="text-xs text-muted-foreground mt-2">
                Click anywhere on the map to move the zone center. Drag the
                marker to fine-tune.
              </p>
            </div>

            {/* Radius Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Radius</Label>
                <span className="text-sm font-medium">
                  {formatRadius(formData.radiusMeters)}
                </span>
              </div>
              <Slider
                value={[formData.radiusMeters]}
                onValueChange={handleRadiusChange}
                min={500}
                max={50000}
                step={500}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>500m</span>
                <span>50km</span>
              </div>
            </div>

            {/* Zone Name */}
            <div className="grid gap-2">
              <Label htmlFor="zone-name">Zone Name</Label>
              <Input
                id="zone-name"
                placeholder="e.g., Free Delivery Zone, Standard Delivery"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            {/* Delivery Fee */}
            <div className="grid gap-2">
              <Label htmlFor="delivery-fee">Delivery Fee ({currency})</Label>
              <Input
                id="delivery-fee"
                type="number"
                min={0}
                step={10}
                placeholder="0"
                value={formData.deliveryFee}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deliveryFee: parseFloat(e.target.value) || 0,
                  }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 for free delivery in this zone
              </p>
            </div>

            {/* Minimum Order */}
            <div className="grid gap-2">
              <Label htmlFor="min-order">
                Minimum Order Amount ({currency})
              </Label>
              <Input
                id="min-order"
                type="number"
                min={0}
                step={100}
                placeholder="Optional"
                value={formData.minOrderAmount ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    minOrderAmount: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>

            {/* Free Shipping Threshold */}
            <div className="grid gap-2">
              <Label htmlFor="free-shipping-threshold">
                Free Shipping Above ({currency})
              </Label>
              <Input
                id="free-shipping-threshold"
                type="number"
                min={0}
                step={100}
                placeholder="Optional"
                value={formData.freeShippingThreshold ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    freeShippingThreshold: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                onWheel={(e) => e.currentTarget.blur()}
              />
              <p className="text-xs text-muted-foreground">
                Orders above this amount get free delivery in this zone
              </p>
            </div>

            {/* Estimated Time */}
            <div className="grid gap-2">
              <Label htmlFor="est-time">Estimated Delivery Time</Label>
              <Input
                id="est-time"
                placeholder="e.g., 30-45 minutes"
                value={formData.estimatedDeliveryTime}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedDeliveryTime: e.target.value,
                  }))
                }
              />
            </div>

            {/* Zone Color */}
            <div className="grid gap-2">
              <Label>Zone Color</Label>
              <div className="flex gap-2 flex-wrap">
                {ZONE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is-active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive zones won&apos;t accept orders
                </p>
              </div>
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? "Saving..."
                : editingZone
                  ? "Save Changes"
                  : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingZone?.name}&quot;?
              Customers in this area will no longer be able to order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
