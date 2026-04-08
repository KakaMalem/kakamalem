"use client";

import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import type { CreateStoreInput } from "@/lib/validations/stores";

interface StepContactProps {
  contactEmail: string;
  contactPhone: string;
  onContactEmailChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  fieldErrors: Partial<Record<keyof CreateStoreInput, string>>;
  disabled?: boolean;
}

export function StepContact({
  contactEmail,
  contactPhone,
  onContactEmailChange,
  onContactPhoneChange,
  fieldErrors,
  disabled,
}: StepContactProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
        <Input
          id="contactEmail"
          type="email"
          value={contactEmail}
          onChange={(e) => onContactEmailChange(e.target.value)}
          placeholder="contact@example.com"
          disabled={disabled}
          aria-invalid={!!fieldErrors.contactEmail}
        />
        <FieldDescription>
          Customers will use this to contact you
        </FieldDescription>
        <FieldError>{fieldErrors.contactEmail}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
        <PhoneInput
          id="contactPhone"
          value={contactPhone}
          onChange={(value) => onContactPhoneChange(value || "")}
          disabled={disabled}
          aria-invalid={!!fieldErrors.contactPhone}
        />
        <FieldError>{fieldErrors.contactPhone}</FieldError>
      </Field>
    </motion.div>
  );
}
