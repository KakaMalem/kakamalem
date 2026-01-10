"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  LocationPicker,
  type LocationData,
} from "@/components/ui/location-picker";
import {
  createAddressAction,
  updateAddressAction,
} from "@/lib/actions/addresses";
import { addressSchema, type AddressInput } from "@/lib/validations/addresses";
import type { UserAddress } from "@/lib/db/queries/addresses";
import { toast } from "sonner";

interface AddressFormProps {
  address?: UserAddress;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AddressForm({
  address,
  onSuccess,
  onCancel,
}: AddressFormProps) {
  const isEditing = !!address;

  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AddressInput, string>>
  >({});

  const [formData, setFormData] = useState<AddressInput>({
    label: address?.label || "",
    firstName: address?.firstName || "",
    lastName: address?.lastName || "",
    phone: address?.phone || "",
    latitude: address?.latitude ? parseFloat(address.latitude) : 0,
    longitude: address?.longitude ? parseFloat(address.longitude) : 0,
    accuracy: address?.accuracy ? parseFloat(address.accuracy) : undefined,
    source: (address?.source as "gps" | "manual") || undefined,
    notes: address?.notes || "",
    isDefault: address?.isDefault || false,
  });

  // Track if location has been set
  const hasLocation = formData.latitude !== 0 || formData.longitude !== 0;

  const handleChange = (
    field: keyof AddressInput,
    value: string | boolean | number
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLocationChange = (location: LocationData) => {
    setFormData((prev) => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      source: location.source,
    }));
    // Clear location errors
    if (fieldErrors.latitude || fieldErrors.longitude) {
      setFieldErrors((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setIsPending(true);

    // Check if location is set
    if (!hasLocation) {
      setFieldErrors({ latitude: "Please select a location on the map" });
      setIsPending(false);
      return;
    }

    // Client-side validation
    const validation = addressSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Partial<Record<keyof AddressInput, string>> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof AddressInput;
        errors[field] = issue.message;
      });
      setFieldErrors(errors);
      setIsPending(false);
      return;
    }

    try {
      const result = isEditing
        ? await updateAddressAction(address.id, formData)
        : await createAddressAction(formData);

      if (result.error) {
        toast.error(result.error.message);
        setIsPending(false);
        return;
      }

      toast.success(isEditing ? "Address updated" : "Address added");
      onSuccess?.();
    } catch {
      toast.error("An unexpected error occurred");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Label (optional) */}
      <Field>
        <FieldLabel htmlFor="label">Label (optional)</FieldLabel>
        <Input
          id="label"
          placeholder="e.g., Home, Office"
          value={formData.label}
          onChange={(e) => handleChange("label", e.target.value)}
          disabled={isPending}
        />
        <FieldError>{fieldErrors.label}</FieldError>
      </Field>

      {/* Name Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="firstName">First name</FieldLabel>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.firstName}
          />
          <FieldError>{fieldErrors.firstName}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="lastName">Last name</FieldLabel>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.lastName}
          />
          <FieldError>{fieldErrors.lastName}</FieldError>
        </Field>
      </div>

      {/* Phone (Required) */}
      <Field>
        <FieldLabel htmlFor="phone">Phone</FieldLabel>
        <Input
          id="phone"
          type="tel"
          placeholder="+93 700 000 000"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          disabled={isPending}
          aria-invalid={!!fieldErrors.phone}
        />
        <FieldDescription>Required for delivery coordination</FieldDescription>
        <FieldError>{fieldErrors.phone}</FieldError>
      </Field>

      {/* Location Picker */}
      <Field>
        <FieldLabel>Delivery Location</FieldLabel>
        <FieldDescription>
          Click on the map or use &quot;Use my current location&quot; to set
          your delivery location
        </FieldDescription>
        <LocationPicker
          value={
            hasLocation
              ? { latitude: formData.latitude, longitude: formData.longitude }
              : null
          }
          onChange={handleLocationChange}
          error={fieldErrors.latitude}
          disabled={isPending}
        />
      </Field>

      {/* Notes (optional) */}
      <Field>
        <FieldLabel htmlFor="notes">Delivery notes (optional)</FieldLabel>
        <Textarea
          id="notes"
          placeholder="Landmarks, directions, building details... e.g., Blue gate, 3rd floor, near Kabul Bank"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={500}
        />
        <FieldError>{fieldErrors.notes}</FieldError>
      </Field>

      {/* Set as default */}
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="isDefault"
          checked={formData.isDefault}
          onCheckedChange={(checked) =>
            handleChange("isDefault", checked === true)
          }
          disabled={isPending}
        />
        <label
          htmlFor="isDefault"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Set as default address
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner />}
          {isEditing ? "Update Address" : "Add Address"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
