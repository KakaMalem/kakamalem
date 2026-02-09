"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  LocationPicker,
  type LocationData,
} from "@/components/ui/location-picker";
import { AddressesMapPreview } from "../addresses-map-preview";
import { cn } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { createAddressAction } from "@/lib/actions/addresses";
import type { Address } from "@/lib/db/schema";
import type { CheckoutDeliveryZone } from "@/lib/actions/unified-delivery";
import {
  shippingAddressSchema,
  type ShippingAddressInput,
} from "@/lib/validations/checkout";

interface SavedAddress {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  latitude: string;
  longitude: string;
  h3Index: string | null;
  plusCode: string | null;
  city: string | null;
  accuracy: string | null;
  source: string | null;
  notes: string | null;
  isDefault: boolean;
}

interface SectionDeliveryProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  userPhone: string;
  savedAddresses: SavedAddress[];
  deliveryZones: CheckoutDeliveryZone[];
  storeLocation?: { lat: number; lng: number } | null;
  onContinue: () => void;
}

export function SectionDelivery({
  user,
  userPhone,
  savedAddresses,
  deliveryZones,
  storeLocation,
  onContinue,
}: SectionDeliveryProps) {
  const {
    customerInfo,
    shippingAddress,
    selectedAddressId,
    setShippingAddress,
    setSelectedAddressId,
  } = useCheckoutStore();

  // Default empty form values
  const getEmptyAddressForm = useCallback(
    (): ShippingAddressInput => ({
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
      phone: userPhone || customerInfo?.phone || "",
      latitude: 0,
      longitude: 0,
      accuracy: undefined,
      source: undefined,
      notes: "",
    }),
    [user?.name, userPhone, customerInfo?.phone]
  );

  // Address form state
  const [showNewAddressForm, setShowNewAddressForm] = useState(
    savedAddresses.length === 0
  );
  const [addressForm, setAddressForm] = useState<ShippingAddressInput>(() => {
    // If we have a shipping address in store and no selectedAddressId,
    // it means user previously entered a new address
    if (shippingAddress && !selectedAddressId) {
      return {
        firstName: shippingAddress.firstName || "",
        lastName: shippingAddress.lastName || "",
        phone: shippingAddress.phone || "",
        latitude: shippingAddress.latitude || 0,
        longitude: shippingAddress.longitude || 0,
        accuracy: shippingAddress.accuracy,
        source: shippingAddress.source,
        notes: shippingAddress.notes || "",
      };
    }
    return getEmptyAddressForm();
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ShippingAddressInput, string>>
  >({});

  // Save address checkbox (only for logged-in users)
  const [saveAddress, setSaveAddress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-select default address on initial load
  useEffect(() => {
    if (savedAddresses.length > 0 && !selectedAddressId && !shippingAddress) {
      const defaultAddress =
        savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      if (defaultAddress) {
        handleAddressSelect(defaultAddress.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to first error
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    setTimeout(() => {
      const firstErrorField = errorFields[0];
      const element = document.getElementById(`delivery-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }, 100);
  }, [errors]);

  const hasLocation = addressForm.latitude !== 0 || addressForm.longitude !== 0;

  // Handle showing new address form
  const handleShowNewAddressForm = () => {
    setAddressForm(getEmptyAddressForm());
    setErrors({});
    setSaveAddress(false);
    setShowNewAddressForm(true);
  };

  // Handle going back to saved addresses
  const handleBackToSavedAddresses = () => {
    setShowNewAddressForm(false);
    if (selectedAddressId) {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (selected) {
        handleAddressSelect(selectedAddressId);
      }
    }
  };

  // Handle saved address selection
  const handleAddressSelect = (addressId: string) => {
    const selected = savedAddresses.find((a) => a.id === addressId);
    if (selected) {
      const address: Address = {
        firstName: selected.firstName,
        lastName: selected.lastName,
        phone: selected.phone || "",
        latitude: parseFloat(selected.latitude),
        longitude: parseFloat(selected.longitude),
        h3Index: selected.h3Index || undefined,
        plusCode: selected.plusCode || undefined,
        city: selected.city || undefined,
        accuracy: selected.accuracy ? parseFloat(selected.accuracy) : undefined,
        source: (selected.source as "gps" | "manual") || undefined,
        notes: selected.notes || undefined,
      };
      setShippingAddress(address);
      setSelectedAddressId(addressId);
      setShowNewAddressForm(false);
    }
  };

  // Handle form changes
  const handleChange = (
    field: keyof ShippingAddressInput,
    value: string | number
  ) => {
    setAddressForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLocationChange = (location: LocationData) => {
    setAddressForm((prev) => ({
      ...prev,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      source: location.source,
    }));
    if (errors.latitude || errors.longitude) {
      setErrors((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
    }
  };

  // Validate and proceed
  const handleContinue = async () => {
    // Using saved address
    if (!showNewAddressForm && savedAddresses.length > 0) {
      if (!shippingAddress) {
        toast.error("Please select a delivery location");
        return;
      }
      onContinue();
      return;
    }

    // Validating new address
    if (!hasLocation) {
      setErrors({ latitude: "Please select a location on the map" });
      toast.error("Please select a location on the map");
      return;
    }

    // For guests, use phone from contact section (customerInfo), name from address form
    const addressToValidate: ShippingAddressInput = {
      ...addressForm,
      phone: user
        ? addressForm.phone
        : customerInfo?.phone || addressForm.phone,
    };

    const validation = shippingAddressSchema.safeParse(addressToValidate);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof ShippingAddressInput, string>> =
        {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ShippingAddressInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error(validation.error.issues[0].message);
      return;
    }

    const address: Address = {
      firstName: validation.data.firstName || "",
      lastName: validation.data.lastName || "",
      phone: validation.data.phone,
      latitude: validation.data.latitude,
      longitude: validation.data.longitude,
      h3Index: validation.data.h3Index,
      plusCode: validation.data.plusCode,
      city: validation.data.city,
      accuracy: validation.data.accuracy,
      source: validation.data.source,
      notes: validation.data.notes || undefined,
    };
    setShippingAddress(address);
    setSelectedAddressId(null);

    // Save address if checkbox checked
    if (user && saveAddress) {
      setIsSaving(true);
      try {
        const result = await createAddressAction({
          firstName: validation.data.firstName,
          lastName: validation.data.lastName,
          phone: validation.data.phone,
          latitude: validation.data.latitude,
          longitude: validation.data.longitude,
          accuracy: validation.data.accuracy,
          source: validation.data.source,
          notes: validation.data.notes,
          isDefault: savedAddresses.length === 0,
        });
        if (result.error) {
          toast.warning("Could not save address to your account");
        } else {
          toast.success("Address saved to your account");
        }
      } catch {
        toast.warning("Could not save address to your account");
      } finally {
        setIsSaving(false);
      }
    }

    onContinue();
  };

  return (
    <div className="space-y-4">
      {/* Saved Addresses */}
      {savedAddresses.length > 0 && !showNewAddressForm && (
        <>
          {/* Map Preview - Always show for visual address confirmation */}
          <AddressesMapPreview
            addresses={savedAddresses}
            deliveryZones={deliveryZones}
            selectedAddressId={selectedAddressId}
            onAddressClick={handleAddressSelect}
            storeLocation={storeLocation}
          />

          <RadioGroup
            value={selectedAddressId || ""}
            onValueChange={handleAddressSelect}
          >
            <div className="space-y-3">
              {savedAddresses.map((address) => (
                <div key={address.id}>
                  <RadioGroupItem
                    value={address.id}
                    id={`address-${address.id}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`address-${address.id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                      "hover:bg-muted/50",
                      "peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-1 peer-data-[state=checked]:ring-primary"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        selectedAddressId === address.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      )}
                    >
                      {selectedAddressId === address.id && (
                        <Check className="size-3" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {address.firstName} {address.lastName}
                        </span>
                        {address.label && (
                          <span className="text-xs text-muted-foreground">
                            ({address.label})
                          </span>
                        )}
                        {address.isDefault && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {address.plusCode
                          ? formatPlusCodeForDisplay(
                              address.plusCode,
                              address.city
                            )
                          : `${parseFloat(address.latitude).toFixed(6)}, ${parseFloat(address.longitude).toFixed(6)}`}
                      </p>
                      {address.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {address.notes}
                        </p>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          <Button
            type="button"
            variant="outline"
            onClick={handleShowNewAddressForm}
            className="w-full"
          >
            <Plus className="mr-2 size-4" />
            Use a different location
          </Button>
        </>
      )}

      {/* New Address Form */}
      {(showNewAddressForm || savedAddresses.length === 0) && (
        <>
          {savedAddresses.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleBackToSavedAddresses}
              className="mb-2"
            >
              &larr; Back to saved locations
            </Button>
          )}

          {/* Name and phone fields only for logged-in users */}
          {/* Guests only need phone (from contact section) + location */}
          {user && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="delivery-firstName">
                    Recipient Name
                  </FieldLabel>
                  <Input
                    id="delivery-firstName"
                    value={addressForm.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    placeholder="First name"
                    aria-invalid={!!errors.firstName}
                  />
                  <FieldError>{errors.firstName}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="delivery-lastName">&nbsp;</FieldLabel>
                  <Input
                    id="delivery-lastName"
                    value={addressForm.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    placeholder="Last name"
                    aria-invalid={!!errors.lastName}
                  />
                  <FieldError>{errors.lastName}</FieldError>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="delivery-phone">Phone</FieldLabel>
                <PhoneInput
                  id="delivery-phone"
                  value={addressForm.phone}
                  onChange={(value) => handleChange("phone", value || "")}
                  defaultCountry="AF"
                  aria-invalid={!!errors.phone}
                />
                <FieldDescription>For delivery coordination</FieldDescription>
                <FieldError>{errors.phone}</FieldError>
              </Field>
            </div>
          )}

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
                  ? {
                      latitude: addressForm.latitude,
                      longitude: addressForm.longitude,
                    }
                  : null
              }
              onChange={handleLocationChange}
              error={errors.latitude}
              deliveryZones={deliveryZones}
              storeLocation={storeLocation}
            />
          </Field>

          {/* Delivery Notes */}
          <Field>
            <FieldLabel htmlFor="delivery-notes">
              Delivery notes
              <span className="text-muted-foreground font-normal ml-1">
                (optional)
              </span>
            </FieldLabel>
            <Textarea
              id="delivery-notes"
              placeholder="Landmarks, directions, building details... e.g., Blue gate, 3rd floor"
              value={addressForm.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              maxLength={500}
            />
          </Field>

          {/* Save address checkbox */}
          {user && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-delivery-address"
                checked={saveAddress}
                onCheckedChange={(checked) => setSaveAddress(checked === true)}
              />
              <Label
                htmlFor="save-delivery-address"
                className="text-sm font-normal cursor-pointer"
              >
                Save this address for future orders
              </Label>
            </div>
          )}
        </>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleContinue} size="lg" disabled={isSaving}>
          {isSaving ? "Saving..." : "Continue to Shipping"}
        </Button>
      </div>
    </div>
  );
}

// Summary component for collapsed state
export function DeliverySummary({
  shippingAddress,
}: {
  shippingAddress: Address | null;
}) {
  if (!shippingAddress) return null;

  const location = shippingAddress.plusCode
    ? formatPlusCodeForDisplay(shippingAddress.plusCode, shippingAddress.city)
    : `${shippingAddress.latitude.toFixed(6)}, ${shippingAddress.longitude.toFixed(6)}`;

  const name =
    `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim();

  return (
    <span className="truncate">
      {name ? `${name} \u2022 ` : ""}
      {location}
    </span>
  );
}
