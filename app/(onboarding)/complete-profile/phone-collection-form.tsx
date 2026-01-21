"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhoneInput, phoneSchema } from "@/components/ui/phone-input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Phone } from "lucide-react";
import { updatePhoneAction } from "@/lib/actions/profile";

interface PhoneCollectionFormProps {
  userName: string;
}

export function PhoneCollectionForm({ userName }: PhoneCollectionFormProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    // Client-side validation
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }

    startTransition(async () => {
      const actionResult = await updatePhoneAction({ phone });

      if (actionResult.error) {
        if (actionResult.error.field === "phone") {
          setFieldError(actionResult.error.message);
        } else {
          setError(actionResult.error.message);
        }
        toast.error(actionResult.error.message);
        return;
      }

      // Success - hard navigation to dashboard
      toast.success("Profile completed!");
      window.location.href = "/dashboard";
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Welcome message */}
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">
            {userName ? `Welcome, ${userName}!` : "Welcome!"}
          </p>
          <p className="text-sm text-muted-foreground">
            We need your phone number to help you manage your stores
          </p>
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor="phone">Phone number</FieldLabel>
        <PhoneInput
          id="phone"
          value={phone}
          onChange={(value) => {
            setPhone(value || "");
            if (fieldError) setFieldError(null);
          }}
          defaultCountry="AF"
          disabled={isPending}
          aria-invalid={!!fieldError}
        />
        <FieldDescription>
          Used for account recovery and important notifications
        </FieldDescription>
        <FieldError>{fieldError}</FieldError>
      </Field>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Spinner />}
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
