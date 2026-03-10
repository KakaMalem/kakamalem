"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

import { useCheckoutStore } from "@/lib/stores/use-checkout-store";
import { guestCheckoutSchema } from "@/lib/validations/checkout";

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
  tenantId: _tenantId,
  storeName: _storeName,
  onContinue,
}: SectionContactProps) {
  void _tenantId;
  void _storeName;
  const { customerInfo, setCustomerInfo } = useCheckoutStore();

  // Guest checkout form state - only phone required
  const [phone, setPhone] = useState(customerInfo?.phone || userPhone || "");
  const [error, setError] = useState<string | null>(null);

  // Scroll to error field
  useEffect(() => {
    if (!error) return;

    setTimeout(() => {
      const element = document.getElementById("contact-phone");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }, 100);
  }, [error]);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (error) {
      setError(null);
    }
  };

  const handleContinue = () => {
    // For logged-in users, just proceed (their info is already known)
    if (user) {
      // Set customer info from user's phone (or existing)
      setCustomerInfo({
        phone: userPhone || phone,
      });
      onContinue();
      return;
    }

    // Validate guest form - only phone required
    const validation = guestCheckoutSchema.safeParse({ phone });
    if (!validation.success) {
      const errorMessage =
        validation.error.issues[0]?.message || "Invalid phone";
      setError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    // Save to store and proceed
    setCustomerInfo({ phone: validation.data.phone });
    onContinue();
  };

  return (
    <div className="space-y-4">
      {/* Guest checkout form - phone only */}
      {!user && (
        <Field>
          <FieldLabel htmlFor="contact-phone">Phone Number</FieldLabel>
          <PhoneInput
            id="contact-phone"
            value={phone}
            onChange={(value) => handlePhoneChange(value || "")}
            aria-invalid={!!error}
          />
          <p className="text-sm text-muted-foreground mt-1">
            We&apos;ll contact you here for delivery updates
          </p>
          <FieldError>{error}</FieldError>
        </Field>
      )}

      {/* Logged-in user info */}
      {user && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold shrink-0">
            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{user.name || "Customer"}</p>
            <p className="text-sm text-muted-foreground truncate">
              {user.email}
            </p>
            {userPhone && (
              <p className="text-sm text-muted-foreground truncate">
                {userPhone}
              </p>
            )}
          </div>
        </div>
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
    phone: string;
  } | null;
}) {
  if (user) {
    return <span>{user.name || user.email}</span>;
  }

  if (customerInfo) {
    return <span>{customerInfo.phone}</span>;
  }

  return null;
}
