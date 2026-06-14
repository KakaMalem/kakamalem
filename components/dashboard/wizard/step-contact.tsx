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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  currencyOptions,
  type CreateStoreInput,
} from "@/lib/validations/stores";
import { CURRENCIES } from "@/lib/currency/currencies";

interface StepContactProps {
  contactEmail: string;
  contactPhone: string;
  currency: string;
  onContactEmailChange: (value: string) => void;
  onContactPhoneChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  fieldErrors: Partial<Record<keyof CreateStoreInput, string>>;
  disabled?: boolean;
}

export function StepContact({
  contactEmail,
  contactPhone,
  currency,
  onContactEmailChange,
  onContactPhoneChange,
  onCurrencyChange,
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

      <Field>
        <FieldLabel htmlFor="currency">Currency</FieldLabel>
        <Select
          value={currency}
          onValueChange={onCurrencyChange}
          disabled={disabled}
        >
          <SelectTrigger id="currency" className="w-full">
            <SelectValue placeholder="Select a currency" />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((code) => {
              const meta = CURRENCIES[code];
              return (
                <SelectItem key={code} value={code}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-6 text-muted-foreground">
                      {meta.symbol}
                    </span>
                    <span>
                      {meta.label}{" "}
                      <span className="text-muted-foreground">({code})</span>
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <FieldDescription>
          The currency your prices will be shown in. You can change this later.
        </FieldDescription>
        <FieldError>{fieldErrors.currency}</FieldError>
      </Field>
    </motion.div>
  );
}
