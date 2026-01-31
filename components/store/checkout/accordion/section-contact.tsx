"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { NotificationPrompt } from "../notification-prompt";
import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import {
  guestCheckoutSchema,
  type GuestCheckoutInput,
} from "@/lib/validations/checkout";

interface SectionContactProps {
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  userPhone: string;
  tenantId: string;
  storeName: string;
  onContinue: () => void;
}

export function SectionContact({
  user,
  userPhone,
  tenantId,
  storeName,
  onContinue,
}: SectionContactProps) {
  const { customerInfo, setCustomerInfo } = useCheckoutStore();

  // Guest checkout form state
  const [guestForm, setGuestForm] = useState<GuestCheckoutInput>({
    email: customerInfo?.email || "",
    firstName: customerInfo?.firstName || "",
    lastName: customerInfo?.lastName || "",
    phone: customerInfo?.phone || userPhone || "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof GuestCheckoutInput, string>>
  >({});

  // Scroll to first error
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    setTimeout(() => {
      const firstErrorField = errorFields[0];
      const element = document.getElementById(`contact-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }, 100);
  }, [errors]);

  const handleChange = (field: keyof GuestCheckoutInput, value: string) => {
    setGuestForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContinue = () => {
    // For logged-in users, just proceed (their info is already known)
    if (user) {
      // Set customer info from user data
      setCustomerInfo({
        email: user.email,
        firstName: user.name?.split(" ")[0] || "",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
        phone: userPhone,
      });
      onContinue();
      return;
    }

    // Validate guest form
    const validation = guestCheckoutSchema.safeParse(guestForm);
    if (!validation.success) {
      const fieldErrors: Partial<Record<keyof GuestCheckoutInput, string>> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof GuestCheckoutInput;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      toast.error(validation.error.issues[0].message);
      return;
    }

    // Save to store and proceed
    setCustomerInfo(validation.data);
    onContinue();
  };

  return (
    <div className="space-y-4">
      {/* Guest checkout form */}
      {!user && (
        <>
          <Field>
            <FieldLabel htmlFor="contact-email">Email</FieldLabel>
            <Input
              id="contact-email"
              type="email"
              value={guestForm.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="your@email.com"
              aria-invalid={!!errors.email}
            />
            <FieldDescription>
              We&apos;ll send order confirmation to this email
            </FieldDescription>
            <FieldError>{errors.email}</FieldError>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contact-firstName">First Name</FieldLabel>
              <Input
                id="contact-firstName"
                value={guestForm.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                aria-invalid={!!errors.firstName}
              />
              <FieldError>{errors.firstName}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-lastName">Last Name</FieldLabel>
              <Input
                id="contact-lastName"
                value={guestForm.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                aria-invalid={!!errors.lastName}
              />
              <FieldError>{errors.lastName}</FieldError>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
            <PhoneInput
              id="contact-phone"
              value={guestForm.phone}
              onChange={(value) => handleChange("phone", value || "")}
              defaultCountry="AF"
              aria-invalid={!!errors.phone}
            />
            <FieldDescription>
              Required for delivery coordination
            </FieldDescription>
            <FieldError>{errors.phone}</FieldError>
          </Field>
        </>
      )}

      {/* Logged-in user info */}
      {user && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold">
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name || "Customer"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {userPhone && (
              <p className="text-sm text-muted-foreground">{userPhone}</p>
            )}
          </div>
        </div>
      )}

      {/* Push Notification Prompt - Only for logged-in users */}
      {user && (
        <NotificationPrompt
          tenantId={tenantId}
          storeName={storeName}
          isLoggedIn={!!user}
        />
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleContinue} size="lg">
          Continue to Delivery
        </Button>
      </div>
    </div>
  );
}

// Summary component for collapsed state
export function ContactSummary({
  user,
  customerInfo,
}: {
  user: { email: string; name: string | null } | null;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
}) {
  if (user) {
    return <span>{user.name || user.email}</span>;
  }

  if (customerInfo) {
    return (
      <span>
        {customerInfo.email} &bull; {customerInfo.phone}
      </span>
    );
  }

  return null;
}
