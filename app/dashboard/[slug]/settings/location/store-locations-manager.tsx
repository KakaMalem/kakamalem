"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  Phone,
  Mail,
  Building2,
} from "lucide-react";
import { LocationPicker, type LocationValue } from "@/components/shared";
import {
  createStoreLocationAction,
  updateStoreLocationAction,
  deleteStoreLocationAction,
  setPrimaryLocationAction,
} from "@/lib/actions/store-locations";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { toast } from "sonner";
import type { StoreLocation } from "@/lib/db/queries/store-locations";

interface StoreLocationsManagerProps {
  tenantId: string;
  storeSlug: string;
  locations: StoreLocation[];
  legacyLocation: {
    latitude: number;
    longitude: number;
    city: string;
    plusCode: string;
    accuracy: number | null;
    source: "gps" | "manual" | null;
  } | null;
}

interface LocationFormData {
  name: string;
  phone: string;
  email: string;
  location: LocationValue | null;
  isPrimary: boolean;
  isActive: boolean;
}

const emptyFormData: LocationFormData = {
  name: "",
  phone: "",
  email: "",
  location: null,
  isPrimary: false,
  isActive: true,
};

export function StoreLocationsManager({
  tenantId,
  storeSlug: _storeSlug,
  locations,
  legacyLocation,
}: StoreLocationsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(
    null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<LocationFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Show migration prompt if there's a legacy location but no locations in the new table
  const showLegacyMigration = legacyLocation && locations.length === 0;

  const handleOpenAddDialog = () => {
    setEditingLocation(null);
    setFormData(emptyFormData);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (location: StoreLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      phone: location.phone || "",
      email: location.email || "",
      location: {
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        city: location.city || undefined,
        plusCode: location.plusCode || undefined,
        accuracy: location.accuracy || undefined,
        source: (location.source as "gps" | "manual") || "manual",
      },
      isPrimary: location.isPrimary,
      isActive: location.isActive,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLocation(null);
    setFormData(emptyFormData);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Location name is required";
    }

    if (!formData.location) {
      errors.location = "Please select a location on the map";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    startTransition(async () => {
      const locationInput = {
        name: formData.name.trim(),
        latitude: formData.location!.latitude,
        longitude: formData.location!.longitude,
        city: formData.location?.city || "",
        plusCode: formData.location?.plusCode || "",
        accuracy: formData.location?.accuracy ?? null,
        source: formData.location?.source ?? null,
        phone: formData.phone.trim() || "",
        email: formData.email.trim() || "",
        isPrimary: formData.isPrimary || locations.length === 0, // First location is always primary
        isActive: formData.isActive,
        displayOrder: editingLocation
          ? editingLocation.displayOrder
          : locations.length,
      };

      const result = editingLocation
        ? await updateStoreLocationAction(
            tenantId,
            editingLocation.id,
            locationInput
          )
        : await createStoreLocationAction(tenantId, locationInput);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success(
        editingLocation
          ? "Location updated successfully"
          : "Location added successfully"
      );
      handleCloseDialog();
      router.refresh();
    });
  };

  const handleDelete = async (locationId: string) => {
    startTransition(async () => {
      const result = await deleteStoreLocationAction(tenantId, locationId);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Location deleted successfully");
      setDeleteConfirmId(null);
      router.refresh();
    });
  };

  const handleSetPrimary = async (locationId: string) => {
    startTransition(async () => {
      const result = await setPrimaryLocationAction(tenantId, locationId);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Primary location updated");
      router.refresh();
    });
  };

  const handleMigrateLegacy = () => {
    if (!legacyLocation) return;

    setEditingLocation(null);
    setFormData({
      name: "Main Store",
      phone: "",
      email: "",
      location: {
        latitude: legacyLocation.latitude,
        longitude: legacyLocation.longitude,
        city: legacyLocation.city || undefined,
        plusCode: legacyLocation.plusCode || undefined,
        accuracy: legacyLocation.accuracy || undefined,
        source: legacyLocation.source || "manual",
      },
      isPrimary: true,
      isActive: true,
    });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Store Locations
              </CardTitle>
              <CardDescription>
                Manage your store&apos;s physical locations. Customers can see
                these on your storefront.
              </CardDescription>
            </div>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Legacy migration prompt */}
          {showLegacyMigration && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-800">
                    Migrate Your Store Location
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    You have a store location set up. Would you like to migrate
                    it to the new multi-location system?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleMigrateLegacy}
                  >
                    Migrate Location
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {locations.length === 0 && !showLegacyMigration && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No locations yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first store location to help customers find you.
              </p>
              <Button onClick={handleOpenAddDialog} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Location
              </Button>
            </div>
          )}

          {/* Locations list */}
          {locations.length > 0 && (
            <div className="space-y-4">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{location.name}</h3>
                      {location.isPrimary && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary"
                        >
                          <Star className="mr-1 h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                      {!location.isActive && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      {location.plusCode
                        ? formatPlusCodeForDisplay(
                            location.plusCode,
                            location.city
                          )
                        : `${parseFloat(location.latitude).toFixed(6)}, ${parseFloat(location.longitude).toFixed(6)}`}
                    </p>
                    {(location.phone || location.email) && (
                      <div className="flex items-center gap-4 pt-1 text-sm text-muted-foreground">
                        {location.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {location.phone}
                          </span>
                        )}
                        {location.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {location.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!location.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(location.id)}
                        disabled={isPending}
                      >
                        <Star className="h-4 w-4" />
                        <span className="sr-only">Set as primary</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditDialog(location)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmId(location.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Edit Location" : "Add Location"}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? "Update the details for this location."
                : "Add a new physical location for your store."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Location Name */}
            <div className="space-y-2">
              <Label htmlFor="location-name">
                Location Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="location-name"
                placeholder="e.g., Main Store, Kabul Branch, Warehouse"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={isPending}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location-phone">Phone (optional)</Label>
                <Input
                  id="location-phone"
                  type="tel"
                  placeholder="+93 70 123 4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-email">Email (optional)</Label>
                <Input
                  id="location-email"
                  type="email"
                  placeholder="branch@store.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Location Picker */}
            <div className="space-y-2">
              <Label>
                Location <span className="text-destructive">*</span>
              </Label>
              <LocationPicker
                value={formData.location}
                onChange={(location) =>
                  setFormData((prev) => ({ ...prev, location }))
                }
                disabled={isPending}
                showGPSButton={true}
                showClearButton={true}
              />
              {formErrors.location && (
                <p className="text-sm text-destructive">
                  {formErrors.location}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Spinner className="mr-2" />}
              {editingLocation ? "Update Location" : "Add Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this location? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Spinner className="mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
