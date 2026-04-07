"use client";

import * as React from "react";
import { useState, useTransition, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Truck,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Layers,
  Gift,
  MapPin,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

// =============================================================================
// COMMON COUNTRIES LIST (for quick selection)
// =============================================================================

const COMMON_COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "PK", name: "Pakistan" },
  { code: "IR", name: "Iran" },
  { code: "TR", name: "Turkey" },
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "EG", name: "Egypt" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
];

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
  states: string[] | null; // provinces
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

// =============================================================================
// CONSTANTS
// =============================================================================

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

const ZONE_TEMPLATES = [
  {
    name: "Domestic",
    countries: [],
    states: [],
    cities: [],
    description: "Ship within your country",
  },
  {
    name: "Regional",
    countries: [],
    states: [],
    cities: [],
    description: "Ship to neighboring countries",
  },
  {
    name: "International",
    countries: [],
    states: [],
    cities: [],
    description: "Ship worldwide",
  },
  {
    name: "Local Delivery",
    countries: [],
    states: [],
    cities: [],
    description: "Local area only",
  },
];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

/**
 * Country multi-select with searchable list of common countries
 * Uses a portal to render dropdown outside parent scroll containers
 */
function CountryMultiSelect({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (countries: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Update dropdown position when opened
  React.useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        pointerEvents: "auto", // Override Dialog's pointer-events: none on body
      });
    }
  }, [open]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleCountry = (countryCode: string) => {
    if (selected.includes(countryCode)) {
      onChange(selected.filter((c) => c !== countryCode));
    } else {
      onChange([...selected, countryCode]);
    }
  };

  const getCountryName = (code: string) => {
    const country = COMMON_COUNTRIES.find((c) => c.code === code);
    return country?.name || code;
  };

  const filteredCountries = COMMON_COUNTRIES.filter(
    (country) =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.code.toLowerCase().includes(search.toLowerCase())
  );

  const dropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className="rounded-md border bg-popover shadow-md"
            style={dropdownStyle}
          >
            {/* Search input */}
            <div className="flex items-center border-b px-3 py-2">
              <input
                type="text"
                placeholder="Search countries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            {/* Scrollable list */}
            <div
              className="p-1"
              style={{
                maxHeight: "256px",
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {filteredCountries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No country found.
                </div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggleCountry(country.code)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        selected.includes(country.code)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {selected.includes(country.code) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                    <span className="flex-1 text-left">{country.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({country.code})
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between h-auto min-h-10"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 ? (
          <span className="text-muted-foreground">Select countries...</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.slice(0, 3).map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">
                {getCountryName(code)}
              </Badge>
            ))}
            {selected.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{selected.length - 3} more
              </Badge>
            )}
          </div>
        )}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {dropdown}
    </div>
  );
}

/**
 * Generic tag input for states/provinces (text-based with Enter to add)
 */
function TagInput({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (
      e.key === "Backspace" &&
      inputValue === "" &&
      values.length > 0
    ) {
      removeTag(values[values.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          disabled={disabled || !inputValue.trim()}
        >
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="text-xs">
              {value}
              <button
                type="button"
                className="ml-1 hover:text-destructive"
                onClick={() => removeTag(value)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

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

  // Zone form
  const [zoneForm, setZoneForm] = useState({
    name: "",
    description: "",
    countries: [] as string[],
    states: [] as string[],
    cities: [] as string[],
    priority: 0,
  });

  // Method form
  const [methodForm, setMethodForm] = useState({
    zoneId: "",
    name: "",
    description: "",
    rateType: "flat" as ShippingRateType,
    baseRate: "0",
    perItemRate: null as string | null,
    freeShippingThreshold: null as string | null,
    minDeliveryDays: null as number | null,
    maxDeliveryDays: null as number | null,
    isActive: true,
  });

  // Expanded zones
  const [expandedZones, setExpandedZones] = useState<Set<string>>(
    new Set(zones.slice(0, 1).map((z) => z.id))
  );

  // ==========================================================================
  // ZONE HANDLERS
  // ==========================================================================

  const resetZoneForm = useCallback(() => {
    setZoneForm({
      name: "",
      description: "",
      countries: [],
      states: [],
      cities: [],
      priority: 0,
    });
    setEditingZone(null);
  }, []);

  const openCreateZoneDialog = useCallback(() => {
    resetZoneForm();
    setZoneDialogOpen(true);
  }, [resetZoneForm]);

  const openEditZoneDialog = useCallback((zone: ShippingZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || "",
      countries: zone.countries || [],
      states: zone.states || [],
      cities: zone.cities || [],
      priority: zone.priority,
    });
    setZoneDialogOpen(true);
  }, []);

  const applyTemplate = useCallback((template: (typeof ZONE_TEMPLATES)[0]) => {
    setZoneForm((prev) => ({
      ...prev,
      name: template.name,
      countries: template.countries,
      states: template.states,
      cities: template.cities,
    }));
  }, []);

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast.error("Zone name is required");
      return;
    }

    const zoneData = {
      name: zoneForm.name.trim(),
      description: zoneForm.description || null,
      countries: zoneForm.countries.length > 0 ? zoneForm.countries : null,
      states: zoneForm.states.length > 0 ? zoneForm.states : null,
      cities: zoneForm.cities.length > 0 ? zoneForm.cities : null,
      postalCodes: null,
      priority: zoneForm.priority,
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
        toast.success("Shipping zone updated");
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
        toast.success("Shipping zone created");
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
      toast.success("Shipping zone deleted");
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
      toast.success(zone.isActive ? "Zone disabled" : "Zone enabled");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update");
    }
  };

  // ==========================================================================
  // METHOD HANDLERS
  // ==========================================================================

  const resetMethodForm = useCallback(() => {
    setMethodForm({
      zoneId: "",
      name: "",
      description: "",
      rateType: "flat",
      baseRate: "0",
      perItemRate: null,
      freeShippingThreshold: null,
      minDeliveryDays: null,
      maxDeliveryDays: null,
      isActive: true,
    });
    setEditingMethod(null);
  }, []);

  const openCreateMethodDialog = useCallback(
    (zoneId: string) => {
      resetMethodForm();
      setMethodForm((prev) => ({ ...prev, zoneId }));
      setMethodDialogOpen(true);
    },
    [resetMethodForm]
  );

  const openEditMethodDialog = useCallback((method: ShippingMethod) => {
    setEditingMethod(method);
    setMethodForm({
      zoneId: method.zoneId,
      name: method.name,
      description: method.description || "",
      rateType: method.rateType,
      baseRate: method.baseRate,
      perItemRate: method.perItemRate,
      freeShippingThreshold: method.freeShippingThreshold,
      minDeliveryDays: method.minDeliveryDays,
      maxDeliveryDays: method.maxDeliveryDays,
      isActive: method.isActive,
    });
    setMethodDialogOpen(true);
  }, []);

  const handleSaveMethod = async () => {
    if (!methodForm.name.trim()) {
      toast.error("Method name is required");
      return;
    }

    if (!methodForm.zoneId) {
      toast.error("Zone is required");
      return;
    }

    const methodData = {
      zoneId: methodForm.zoneId,
      name: methodForm.name.trim(),
      description: methodForm.description || null,
      minDeliveryDays: methodForm.minDeliveryDays,
      maxDeliveryDays: methodForm.maxDeliveryDays,
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

  // ==========================================================================
  // HELPERS
  // ==========================================================================

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

  const getZoneLocationLabel = (zone: ShippingZone): string => {
    const parts: string[] = [];

    // Show cities if specified
    if (zone.cities && zone.cities.length > 0) {
      if (zone.cities.length <= 2) {
        parts.push(zone.cities.join(", "));
      } else {
        parts.push(
          `${zone.cities.slice(0, 2).join(", ")} +${zone.cities.length - 2} cities`
        );
      }
    }
    // Show states if specified
    else if (zone.states && zone.states.length > 0) {
      if (zone.states.length <= 2) {
        parts.push(zone.states.join(", "));
      } else {
        parts.push(
          `${zone.states.slice(0, 2).join(", ")} +${zone.states.length - 2} states`
        );
      }
    }
    // Show countries if specified
    else if (zone.countries && zone.countries.length > 0) {
      const countryNames = zone.countries.map((code) => {
        const country = COMMON_COUNTRIES.find((c) => c.code === code);
        return country?.name || code;
      });
      if (countryNames.length <= 2) {
        parts.push(countryNames.join(", "));
      } else {
        parts.push(
          `${countryNames.slice(0, 2).join(", ")} +${countryNames.length - 2} countries`
        );
      }
    }
    // Catch-all zone
    else {
      parts.push("Worldwide");
    }

    return parts.join(" - ");
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
      default:
        rateText = base;
    }

    if (threshold > 0 && baseValue > 0) {
      return `${rateText} (free over ${formatPrice(threshold, currency)})`;
    }

    return rateText;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <>
      <div className="space-y-3">
        {/* Empty State */}
        {zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Truck className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">No shipping zones</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Create zones for different countries or regions with custom rates.
            </p>
            <Button onClick={openCreateZoneDialog} size="sm">
              <Plus className="mr-1.5 size-4" />
              Create Zone
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {zones.length} zone{zones.length !== 1 ? "s" : ""}
              </p>
              <Button
                onClick={openCreateZoneDialog}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-1.5 size-4" />
                Add Zone
              </Button>
            </div>

            {/* Zones List */}
            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className={cn(
                    "rounded-lg border",
                    !zone.isActive && "opacity-50"
                  )}
                >
                  <Collapsible
                    open={expandedZones.has(zone.id)}
                    onOpenChange={() => toggleZoneExpanded(zone.id)}
                  >
                    {/* Zone Header */}
                    <div className="flex items-center gap-2 p-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-left hover:text-primary flex-1 min-w-0">
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 transition-transform",
                              !expandedZones.has(zone.id) && "-rotate-90"
                            )}
                          />
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-medium text-sm">
                              {zone.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[11px] px-1.5 py-0 gap-0.5"
                            >
                              <MapPin className="h-3 w-3" />
                              {getZoneLocationLabel(zone)}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-[11px] px-1.5 py-0"
                            >
                              {zone.methods.length} rate
                              {zone.methods.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex items-center shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleToggleZone(zone)}
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
                          className="size-7"
                          onClick={() => openEditZoneDialog(zone)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setZoneToDelete(zone);
                            setDeleteZoneDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Zone Content */}
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0">
                        <div className="space-y-2">
                          {zone.methods.length === 0 ? (
                            <div className="rounded-md border border-dashed p-4 text-center">
                              <p className="text-sm text-muted-foreground mb-2">
                                No rates configured
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCreateMethodDialog(zone.id)}
                              >
                                <Plus className="mr-1.5 size-4" />
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
                                      "flex items-center justify-between rounded-md border p-2.5 transition-colors hover:bg-muted/30",
                                      !method.isActive &&
                                        "opacity-50 bg-muted/10"
                                    )}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={cn(
                                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
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
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-sm">
                                            {method.name}
                                          </span>
                                          {!method.isActive && (
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px] px-1 py-0"
                                            >
                                              Off
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {getRateDescription(method)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() =>
                                          handleToggleMethod(method)
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
                                        className="size-7"
                                        onClick={() =>
                                          openEditMethodDialog(method)
                                        }
                                      >
                                        <Pencil className="size-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        onClick={() => {
                                          setMethodToDelete(method);
                                          setDeleteMethodDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="size-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-muted-foreground hover:text-foreground"
                                onClick={() => openCreateMethodDialog(zone.id)}
                              >
                                <Plus className="mr-1.5 size-4" />
                                Add Rate
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
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingZone ? "Edit Shipping Zone" : "Create Shipping Zone"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Define which areas this zone covers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1 overflow-y-auto flex-1 pr-1">
            {/* Quick Templates */}
            {!editingZone && (
              <div className="flex flex-wrap gap-1.5">
                {ZONE_TEMPLATES.map((template) => (
                  <Button
                    key={template.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => applyTemplate(template)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Zone Name */}
            <div className="space-y-1.5">
              <Label htmlFor="zoneName" className="text-sm">
                Zone Name *
              </Label>
              <Input
                id="zoneName"
                value={zoneForm.name}
                onChange={(e) =>
                  setZoneForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Domestic, Europe, Middle East"
                className="h-9"
              />
            </div>

            {/* Countries */}
            <div className="space-y-1.5">
              <Label className="text-sm">Countries</Label>
              <p className="text-xs text-muted-foreground">
                Leave empty for worldwide (catch-all)
              </p>
              <CountryMultiSelect
                selected={zoneForm.countries}
                onChange={(countries) =>
                  setZoneForm((prev) => ({ ...prev, countries }))
                }
              />
              {zoneForm.countries.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {zoneForm.countries.map((code) => {
                    const country = COMMON_COUNTRIES.find(
                      (c) => c.code === code
                    );
                    return (
                      <Badge
                        key={code}
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {country?.name || code}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() =>
                            setZoneForm((prev) => ({
                              ...prev,
                              countries: prev.countries.filter(
                                (c) => c !== code
                              ),
                            }))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* States/Provinces */}
            <div className="space-y-1.5">
              <Label className="text-sm">States / Provinces</Label>
              <TagInput
                values={zoneForm.states}
                onChange={(states) =>
                  setZoneForm((prev) => ({ ...prev, states }))
                }
                placeholder="Type and press Enter..."
              />
            </div>

            {/* Cities */}
            <div className="space-y-1.5">
              <Label className="text-sm">Cities</Label>
              <TagInput
                values={zoneForm.cities}
                onChange={(cities) =>
                  setZoneForm((prev) => ({ ...prev, cities }))
                }
                placeholder="Type and press Enter..."
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="zoneDescription" className="text-sm">
                Description
              </Label>
              <Textarea
                id="zoneDescription"
                value={zoneForm.description}
                onChange={(e) =>
                  setZoneForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Internal note (optional)"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setZoneDialogOpen(false);
                resetZoneForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveZone} disabled={isPending} size="sm">
              {editingZone ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Method Dialog */}
      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingMethod ? "Edit Rate" : "Add Rate"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure shipping pricing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1 overflow-y-auto flex-1 pr-1">
            {/* Basic Info */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="methodName" className="text-sm">
                  Name *
                </Label>
                <Input
                  id="methodName"
                  value={methodForm.name}
                  onChange={(e) =>
                    setMethodForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Standard, Express"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="methodDescription" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="methodDescription"
                  value={methodForm.description}
                  onChange={(e) =>
                    setMethodForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Shown at checkout"
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Delivery Time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="minDays" className="text-sm">
                    Min Days
                  </Label>
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
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="2"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxDays" className="text-sm">
                    Max Days
                  </Label>
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
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="5"
                    className="h-9"
                  />
                </div>
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
                        "flex items-center gap-2.5 rounded-md border p-2.5 transition-all text-left",
                        "hover:border-primary/50 hover:bg-muted/50",
                        isSelected && "border-primary bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
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
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              {/* Base Rate */}
              <div className="space-y-1.5">
                <Label htmlFor="baseRate" className="text-sm">
                  {methodForm.rateType === "per_item" ? "Base Rate" : "Rate"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
                    className="pl-11 h-9"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Per Item Rate */}
              {methodForm.rateType === "per_item" && (
                <div className="space-y-1.5">
                  <Label htmlFor="perItemRate" className="text-sm">
                    Per Item
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
                      className="pl-11 h-9"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {/* Free Shipping Threshold */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="enableFreeThreshold"
                    className="flex items-center gap-1.5 cursor-pointer text-sm"
                  >
                    <Gift className="h-3.5 w-3.5 text-green-600" />
                    Free above
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
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
                      className="pl-11 h-9"
                      placeholder="1000"
                    />
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="rounded bg-background p-2 border text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Preview:</span>
                  <span className="font-medium text-primary">
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
            <div className="flex items-center justify-between rounded-md border p-2.5">
              <div>
                <Label htmlFor="isActive" className="text-sm font-medium">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  {methodForm.isActive ? "Visible" : "Hidden"}
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
            <AlertDialogTitle>Delete Shipping Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{zoneToDelete?.name}&quot;?
              This will also delete all shipping rates in this zone.
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
