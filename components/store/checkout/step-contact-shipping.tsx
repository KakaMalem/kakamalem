"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AddressesMapPreview } from "./addresses-map-preview";
import { NotificationPrompt } from "./notification-prompt";
import { cn } from "@/lib/utils";
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { createAddressAction } from "@/lib/actions/addresses";
import type { Address, DeliveryZone } from "@/lib/db/schema";
import {
  guestCheckoutSchema,
  shippingAddressSchema,
  type GuestCheckoutInput,
  type ShippingAddressInput,
} from "@/lib/validations/checkout";

interface StepContactShippingProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  userPhone: string;
  savedAddresses: Array<{
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
  }>;
  tenantId: string;
  storeSlug: string;
  storeName: string;
  deliveryZones: DeliveryZone[];
}

export function StepContactShipping({
  user,
  userPhone,
  savedAddresses,
  tenantId,
  storeSlug: _storeSlug,
  storeName,
  deliveryZones,
}: StepContactShippingProps) {
  // storeSlug is available for future use if needed
  void _storeSlug;

  const {
    customerInfo,
    shippingAddress,
    selectedAddressId,
    setCustomerInfo,
    setShippingAddress,
    setSelectedAddressId,
    setStep,
    completeStep,
  } = useCheckoutStore();

  // Guest checkout form state
  const [guestForm, setGuestForm] = useState<GuestCheckoutInput>({
    email: customerInfo?.email || "",
    firstName: customerInfo?.firstName || "",
    lastName: customerInfo?.lastName || "",
    phone: customerInfo?.phone || "",
  });
  const [guestErrors, setGuestErrors] = useState<
    Partial<Record<keyof GuestCheckoutInput, string>>
  >({});

  // Default empty form values
  const getEmptyAddressForm = useCallback(
    (): ShippingAddressInput => ({
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
      phone: userPhone,
      latitude: 0,
      longitude: 0,
      accuracy: undefined,
      source: undefined,
      notes: "",
    }),
    [user?.name, userPhone]
  );

  // Address form state (for new address)
  const [showNewAddressForm, setShowNewAddressForm] = useState(
    savedAddresses.length === 0
  );
  const [addressForm, setAddressForm] = useState<ShippingAddressInput>(() => {
    // If we have a shipping address in store and no selectedAddressId,
    // it means user previously entered a new address
    if (shippingAddress && !selectedAddressId) {
      return {
        firstName: shippingAddress.firstName || user?.name?.split(" ")[0] || "",
        lastName:
          shippingAddress.lastName ||
          user?.name?.split(" ").slice(1).join(" ") ||
          "",
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
  const [addressErrors, setAddressErrors] = useState<
    Partial<Record<keyof ShippingAddressInput, string>>
  >({});

  // Save address checkbox (only for logged-in users)
  const [saveAddress, setSaveAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Auto-select default address on initial load (only if no address selected yet)
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

  // Scroll to first error field when guestErrors or addressErrors change
  useEffect(() => {
    const allErrors = { ...guestErrors, ...addressErrors };
    const errorFields = Object.keys(allErrors);
    if (errorFields.length === 0) return;

    // Small delay to ensure DOM is updated
    setTimeout(() => {
      const firstErrorField = errorFields[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }, 100);
  }, [guestErrors, addressErrors]);

  // Track if location has been set
  const hasLocation = addressForm.latitude !== 0 || addressForm.longitude !== 0;

  // Handle showing new address form (with reset)
  const handleShowNewAddressForm = () => {
    setAddressForm(getEmptyAddressForm());
    setAddressErrors({});
    setSaveAddress(false);
    setShowNewAddressForm(true);
  };

  // Handle going back to saved addresses
  const handleBackToSavedAddresses = () => {
    setShowNewAddressForm(false);
    // If there was a previously selected address, restore it
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

  // Handle form field changes
  const handleGuestChange = (
    field: keyof GuestCheckoutInput,
    value: string
  ) => {
    setGuestForm((prev) => ({ ...prev, [field]: value }));
    if (guestErrors[field]) {
      setGuestErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddressChange = (
    field: keyof ShippingAddressInput,
    value: string | number
  ) => {
    setAddressForm((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
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
    // Clear location errors
    if (addressErrors.latitude || addressErrors.longitude) {
      setAddressErrors((prev) => ({
        ...prev,
        latitude: undefined,
        longitude: undefined,
      }));
    }
  };

  // Validate and proceed
  const handleContinue = async () => {
    let hasErrors = false;
    let firstErrorMessage: string | null = null;

    // Validate guest info (if not logged in)
    if (!user) {
      const guestValidation = guestCheckoutSchema.safeParse(guestForm);
      if (!guestValidation.success) {
        const errors: Partial<Record<keyof GuestCheckoutInput, string>> = {};
        guestValidation.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof GuestCheckoutInput;
          errors[field] = issue.message;
        });
        setGuestErrors(errors);
        if (!firstErrorMessage) {
          firstErrorMessage = guestValidation.error.issues[0].message;
        }
        hasErrors = true;
      } else {
        setCustomerInfo(guestValidation.data);
      }
    }

    // Validate address (if entering new)
    if (showNewAddressForm || savedAddresses.length === 0) {
      // Check if location is set
      if (!hasLocation) {
        const errorMsg = "Please select a location on the map";
        setAddressErrors({ latitude: errorMsg });
        if (!firstErrorMessage) {
          firstErrorMessage = errorMsg;
        }
        hasErrors = true;
      } else {
        // For guests, merge name and phone from guestForm
        // For logged-in users, use addressForm fields directly
        const addressToValidate: ShippingAddressInput = {
          ...addressForm,
          firstName: user ? addressForm.firstName : guestForm.firstName,
          lastName: user ? addressForm.lastName : guestForm.lastName,
          phone: user ? addressForm.phone : guestForm.phone,
        };

        const addressValidation =
          shippingAddressSchema.safeParse(addressToValidate);
        if (!addressValidation.success) {
          const errors: Partial<Record<keyof ShippingAddressInput, string>> =
            {};
          addressValidation.error.issues.forEach((issue) => {
            const field = issue.path[0] as keyof ShippingAddressInput;
            errors[field] = issue.message;
          });
          setAddressErrors(errors);
          if (!firstErrorMessage) {
            firstErrorMessage = addressValidation.error.issues[0].message;
          }
          hasErrors = true;
        } else {
          const address: Address = {
            firstName: addressValidation.data.firstName || "",
            lastName: addressValidation.data.lastName || "",
            phone: addressValidation.data.phone,
            latitude: addressValidation.data.latitude,
            longitude: addressValidation.data.longitude,
            h3Index: addressValidation.data.h3Index,
            plusCode: addressValidation.data.plusCode,
            city: addressValidation.data.city,
            accuracy: addressValidation.data.accuracy,
            source: addressValidation.data.source,
            notes: addressValidation.data.notes || undefined,
          };
          setShippingAddress(address);
          setSelectedAddressId(null);

          // Save address to user's account if checkbox is checked
          if (user && saveAddress) {
            setIsSavingAddress(true);
            try {
              const result = await createAddressAction({
                firstName: addressValidation.data.firstName,
                lastName: addressValidation.data.lastName,
                phone: addressValidation.data.phone,
                latitude: addressValidation.data.latitude,
                longitude: addressValidation.data.longitude,
                accuracy: addressValidation.data.accuracy,
                source: addressValidation.data.source,
                notes: addressValidation.data.notes,
                isDefault: savedAddresses.length === 0, // Make default if first address
              });
              if (result.error) {
                // Don't block checkout, just show a warning
                toast.warning("Could not save address to your account");
              } else {
                toast.success("Address saved to your account");
              }
            } catch {
              toast.warning("Could not save address to your account");
            } finally {
              setIsSavingAddress(false);
            }
          }
        }
      }
    } else if (!shippingAddress) {
      // No address selected from saved addresses
      const errorMsg = "Please select a delivery location";
      toast.error(errorMsg);
      hasErrors = true;
    }

    if (hasErrors && firstErrorMessage) {
      toast.error(firstErrorMessage);
    }

    if (!hasErrors) {
      completeStep(1);
      setStep(2);
    }
  };

  return (
    <div className="space-y-6">
      {/* Contact Information (Guest Only) */}
      {!user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={guestForm.email}
                onChange={(e) => handleGuestChange("email", e.target.value)}
                placeholder="your@email.com"
                aria-invalid={!!guestErrors.email}
              />
              <FieldDescription>
                We&apos;ll send order confirmation to this email
              </FieldDescription>
              <FieldError>{guestErrors.email}</FieldError>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>First Name</FieldLabel>
                <Input
                  value={guestForm.firstName}
                  onChange={(e) =>
                    handleGuestChange("firstName", e.target.value)
                  }
                  aria-invalid={!!guestErrors.firstName}
                />
                <FieldError>{guestErrors.firstName}</FieldError>
              </Field>
              <Field>
                <FieldLabel>Last Name</FieldLabel>
                <Input
                  value={guestForm.lastName}
                  onChange={(e) =>
                    handleGuestChange("lastName", e.target.value)
                  }
                  aria-invalid={!!guestErrors.lastName}
                />
                <FieldError>{guestErrors.lastName}</FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel>Phone</FieldLabel>
              <PhoneInput
                value={guestForm.phone}
                onChange={(value) => handleGuestChange("phone", value || "")}
                defaultCountry="AF"
                aria-invalid={!!guestErrors.phone}
              />
              <FieldDescription>
                Required for delivery coordination
              </FieldDescription>
              <FieldError>{guestErrors.phone}</FieldError>
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Logged-in User Info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{user.name || "Customer"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Push Notification Prompt - Only for logged-in users */}
      {user && (
        <NotificationPrompt
          tenantId={tenantId}
          storeName={storeName}
          isLoggedIn={!!user}
        />
      )}

      {/* Delivery Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Delivery Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved Addresses */}
          {savedAddresses.length > 0 && !showNewAddressForm && (
            <>
              {/* Map Preview with Delivery Zones and Address Markers */}
              {deliveryZones.length > 0 && (
                <AddressesMapPreview
                  addresses={savedAddresses}
                  deliveryZones={deliveryZones}
                  selectedAddressId={selectedAddressId}
                  onAddressClick={handleAddressSelect}
                />
              )}

              <RadioGroup
                value={selectedAddressId || ""}
                onValueChange={handleAddressSelect}
              >
                <div className="space-y-3">
                  {savedAddresses.map((address) => (
                    <div key={address.id}>
                      <RadioGroupItem
                        value={address.id}
                        id={address.id}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={address.id}
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
                              : `${parseFloat(address.latitude).toFixed(
                                  6
                                )}, ${parseFloat(address.longitude).toFixed(
                                  6
                                )}`}
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
                  className="mb-4"
                >
                  &larr; Back to saved locations
                </Button>
              )}

              {/* Name and phone fields for logged-in users */}
              {user && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>First Name</FieldLabel>
                      <Input
                        id="firstName"
                        value={addressForm.firstName}
                        onChange={(e) =>
                          handleAddressChange("firstName", e.target.value)
                        }
                        aria-invalid={!!addressErrors.firstName}
                      />
                      <FieldError>{addressErrors.firstName}</FieldError>
                    </Field>
                    <Field>
                      <FieldLabel>Last Name</FieldLabel>
                      <Input
                        id="lastName"
                        value={addressForm.lastName}
                        onChange={(e) =>
                          handleAddressChange("lastName", e.target.value)
                        }
                        aria-invalid={!!addressErrors.lastName}
                      />
                      <FieldError>{addressErrors.lastName}</FieldError>
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel>Phone</FieldLabel>
                    <PhoneInput
                      id="phone"
                      value={addressForm.phone}
                      onChange={(value) =>
                        handleAddressChange("phone", value || "")
                      }
                      defaultCountry="AF"
                      aria-invalid={!!addressErrors.phone}
                    />
                    <FieldDescription>
                      Required for delivery coordination
                    </FieldDescription>
                    <FieldError>{addressErrors.phone}</FieldError>
                  </Field>
                </div>
              )}

              {/* Location Picker */}
              <Field>
                <FieldLabel>Delivery Location</FieldLabel>
                <FieldDescription>
                  Click on the map or use &quot;Use my current location&quot; to
                  set your delivery location
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
                  error={addressErrors.latitude}
                  deliveryZones={deliveryZones}
                />
              </Field>

              {/* Notes (optional) */}
              <Field>
                <FieldLabel>Delivery notes (optional)</FieldLabel>
                <Textarea
                  placeholder="Landmarks, directions, building details... e.g., Blue gate, 3rd floor, near Kabul Bank"
                  value={addressForm.notes}
                  onChange={(e) => handleAddressChange("notes", e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </Field>

              {/* Save address checkbox for logged-in users */}
              {user && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="save-address"
                    checked={saveAddress}
                    onCheckedChange={(checked) =>
                      setSaveAddress(checked === true)
                    }
                  />
                  <Label
                    htmlFor="save-address"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Save this address for future orders
                  </Label>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button onClick={handleContinue} size="lg" disabled={isSavingAddress}>
          {isSavingAddress ? "Saving address..." : "Continue to Delivery"}
          {!isSavingAddress && <ChevronRight className="ml-2 size-4" />}
        </Button>
      </div>
    </div>
  );
}
