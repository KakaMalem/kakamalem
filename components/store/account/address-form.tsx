"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAddressAction,
  updateAddressAction,
  addressSchema,
  type AddressInput,
} from "@/lib/actions/addresses";
import type { UserAddress } from "@/lib/db/queries/addresses";
import { toast } from "sonner";

// Common countries - Afghanistan first as primary market
const COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "PK", name: "Pakistan" },
  { code: "IR", name: "Iran" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "CA", name: "Canada" },
  { code: "TR", name: "Turkey" },
  { code: "IN", name: "India" },
];

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
    street1: address?.street1 || "",
    street2: address?.street2 || "",
    city: address?.city || "",
    state: address?.state || "",
    postalCode: address?.postalCode || "",
    countryCode: address?.countryCode || "AF",
    isDefault: address?.isDefault || false,
  });

  const handleChange = (field: keyof AddressInput, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setIsPending(true);

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

      {/* Phone */}
      <Field>
        <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
        <Input
          id="phone"
          type="tel"
          placeholder="+93 700 000 000"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          disabled={isPending}
        />
        <FieldError>{fieldErrors.phone}</FieldError>
      </Field>

      {/* Street Address */}
      <Field>
        <FieldLabel htmlFor="street1">Street address</FieldLabel>
        <Input
          id="street1"
          value={formData.street1}
          onChange={(e) => handleChange("street1", e.target.value)}
          disabled={isPending}
          aria-invalid={!!fieldErrors.street1}
        />
        <FieldError>{fieldErrors.street1}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="street2">
          Apartment, suite, etc. (optional)
        </FieldLabel>
        <Input
          id="street2"
          value={formData.street2}
          onChange={(e) => handleChange("street2", e.target.value)}
          disabled={isPending}
        />
        <FieldError>{fieldErrors.street2}</FieldError>
      </Field>

      {/* City & State Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="city">City</FieldLabel>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.city}
          />
          <FieldError>{fieldErrors.city}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="state">State / Province</FieldLabel>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => handleChange("state", e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.state}
          />
          <FieldError>{fieldErrors.state}</FieldError>
        </Field>
      </div>

      {/* Postal & Country Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="postalCode">Postal code</FieldLabel>
          <Input
            id="postalCode"
            value={formData.postalCode}
            onChange={(e) => handleChange("postalCode", e.target.value)}
            disabled={isPending}
            aria-invalid={!!fieldErrors.postalCode}
          />
          <FieldError>{fieldErrors.postalCode}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="countryCode">Country</FieldLabel>
          <Select
            value={formData.countryCode}
            onValueChange={(value) => handleChange("countryCode", value)}
            disabled={isPending}
          >
            <SelectTrigger id="countryCode">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldErrors.countryCode}</FieldError>
        </Field>
      </div>

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
