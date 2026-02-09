"use client";

import { useState, useTransition, useMemo } from "react";
import {
  MapPin,
  Circle,
  Globe,
  Earth,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";
import {
  getCountryName,
  getCountryFlag,
  formatRadius,
} from "@/lib/delivery/geojson-config";
import {
  deleteUnifiedZone,
  toggleUnifiedZoneActive,
  type UnifiedZoneWithMethods,
} from "@/lib/actions/unified-delivery";
import type { UnifiedZoneType } from "@/lib/validations/unified-delivery";
import { toast } from "sonner";

const ZONE_TYPE_ICONS: Partial<Record<UnifiedZoneType, React.ReactNode>> = {
  polygon: <MapPin className="h-4 w-4" />,
  radius: <Circle className="h-4 w-4" />,
  country: <Globe className="h-4 w-4" />,
  worldwide: <Earth className="h-4 w-4" />,
};

interface ZoneListProps {
  tenantId: string;
  zones: UnifiedZoneWithMethods[];
  selectedZoneId?: string | null;
  onSelectZone: (zone: UnifiedZoneWithMethods | null) => void;
  onEditZone: (zone: UnifiedZoneWithMethods) => void;
  onAddZone: () => void;
}

export function ZoneList({
  tenantId,
  zones,
  selectedZoneId,
  onSelectZone,
  onEditZone,
  onAddZone,
}: ZoneListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] =
    useState<UnifiedZoneWithMethods | null>(null);
  const [isPending, startTransition] = useTransition();

  // Group zones by type for better organization
  const groupedZones = useMemo(() => {
    const groups: Record<string, UnifiedZoneWithMethods[]> = {};

    zones.forEach((zone) => {
      const type = zone.zoneType;

      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(zone);
    });

    // Sort by specificity (highest first)
    const order: UnifiedZoneType[] = [
      "radius",
      "polygon",
      "country",
      "worldwide",
    ];

    return order
      .filter((type) => groups[type]?.length > 0)
      .map((type) => ({
        type,
        zones: groups[type],
      }));
  }, [zones]);

  const handleDelete = async () => {
    if (!zoneToDelete) return;

    startTransition(async () => {
      const result = await deleteUnifiedZone(tenantId, zoneToDelete.id);
      if (result.success) {
        toast.success("Delivery option deleted");
        if (selectedZoneId === zoneToDelete.id) {
          onSelectZone(null);
        }
      } else {
        toast.error(result.error || "Failed to delete");
      }
      setZoneToDelete(null);
      setDeleteDialogOpen(false);
    });
  };

  const handleToggleActive = async (zone: UnifiedZoneWithMethods) => {
    startTransition(async () => {
      const result = await toggleUnifiedZoneActive(
        tenantId,
        zone.id,
        !zone.isActive
      );
      if (result.success) {
        toast.success(zone.isActive ? "Deactivated" : "Activated");
      } else {
        toast.error(result.error || "Failed to update");
      }
    });
  };

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Globe className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-base mb-1">No Delivery Options</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-55">
          Create your first delivery option to define where and how you deliver.
        </p>
        <Button onClick={onAddZone} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Delivery Option
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Delivery Options</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {zones.length} option{zones.length !== 1 && "s"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onAddZone}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Zone groups */}
      <div className="space-y-3">
        {groupedZones.map(({ type, zones: groupZones }) => (
          <ZoneGroup
            key={type}
            type={type}
            zones={groupZones}
            selectedZoneId={selectedZoneId}
            onSelectZone={onSelectZone}
            onEditZone={onEditZone}
            onDeleteZone={(zone) => {
              setZoneToDelete(zone);
              setDeleteDialogOpen(true);
            }}
            onToggleActive={handleToggleActive}
            isPending={isPending}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{zoneToDelete?.name}
              &rdquo;? This action cannot be undone.
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
    </div>
  );
}

// =============================================================================
// ZONE GROUP
// =============================================================================

interface ZoneGroupProps {
  type: UnifiedZoneType;
  zones: UnifiedZoneWithMethods[];
  selectedZoneId?: string | null;
  onSelectZone: (zone: UnifiedZoneWithMethods | null) => void;
  onEditZone: (zone: UnifiedZoneWithMethods) => void;
  onDeleteZone: (zone: UnifiedZoneWithMethods) => void;
  onToggleActive: (zone: UnifiedZoneWithMethods) => void;
  isPending: boolean;
}

const ZONE_TYPE_LABELS: Partial<Record<UnifiedZoneType, string>> = {
  radius: "Local Delivery (Radius)",
  polygon: "Local Delivery (Custom)",
  country: "Shipping (Countries)",
  worldwide: "Worldwide Shipping",
};

function ZoneGroup({
  type,
  zones,
  selectedZoneId,
  onSelectZone,
  onEditZone,
  onDeleteZone,
  onToggleActive,
  isPending,
}: ZoneGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="text-muted-foreground">{ZONE_TYPE_ICONS[type]}</span>
          <span>{ZONE_TYPE_LABELS[type]}</span>
          <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
            {zones.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-1.5 pl-2">
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            isSelected={selectedZoneId === zone.id}
            onSelect={() =>
              onSelectZone(selectedZoneId === zone.id ? null : zone)
            }
            onEdit={() => onEditZone(zone)}
            onDelete={() => onDeleteZone(zone)}
            onToggleActive={() => onToggleActive(zone)}
            isPending={isPending}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// ZONE CARD
// =============================================================================

interface ZoneCardProps {
  zone: UnifiedZoneWithMethods;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  isPending: boolean;
}

function ZoneCard({
  zone,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggleActive,
  isPending,
}: ZoneCardProps) {
  const method = zone.methods[0]; // One zone = one method now

  const getZoneSubtitle = () => {
    const type = zone.zoneType as UnifiedZoneType;
    const countries = zone.countries as string[] | null;

    switch (type) {
      case "country":
        if (countries && countries.length <= 2) {
          return countries
            .map((c) => `${getCountryFlag(c)} ${getCountryName(c)}`)
            .join(", ");
        }
        return countries ? `${countries.length} countries` : "";
      case "radius":
        return zone.radiusMeters ? formatRadius(zone.radiusMeters) : "";
      case "worldwide":
        return "All locations";
      case "polygon":
        return "Custom area";
      default:
        return "";
    }
  };

  const getPriceText = () => {
    if (!method) return "";
    const rate = parseFloat(method.baseRate);
    if (method.rateType === "free" || rate === 0) return "Free";
    return `${rate.toLocaleString()} AFN`;
  };

  const getTimingText = () => {
    if (!method) return "";
    if (method.estimatedTime) return method.estimatedTime;
    if (method.minDeliveryDays && method.maxDeliveryDays) {
      return `${method.minDeliveryDays}-${method.maxDeliveryDays}d`;
    }
    return "";
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-150",
        isSelected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-muted-foreground/30",
        !zone.isActive && "opacity-50"
      )}
    >
      {/* Main card content */}
      <div
        className="flex items-start gap-2.5 p-2.5 cursor-pointer"
        onClick={onSelect}
      >
        {/* Color indicator */}
        <div
          className="w-1 h-10 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: zone.color || "#3b82f6" }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{zone.name}</span>
            {!zone.isActive && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 text-amber-600 border-amber-200 bg-amber-50"
              >
                Off
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {getZoneSubtitle()}
          </p>
          {/* Pricing and timing info */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-medium text-primary">
              {getPriceText()}
            </span>
            {getTimingText() && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-[11px] text-muted-foreground">
                  {getTimingText()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleActive} disabled={isPending}>
              {zone.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              disabled={isPending}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
