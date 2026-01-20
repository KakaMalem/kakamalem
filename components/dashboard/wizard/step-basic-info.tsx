"use client";

import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { CreateStoreInput } from "@/lib/validations/stores";

interface StepBasicInfoProps {
  name: string;
  slug: string;
  tagline: string;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onTaglineChange: (value: string) => void;
  fieldErrors: Partial<Record<keyof CreateStoreInput, string>>;
  checkingSlug: boolean;
  slugAvailable: boolean | null;
  disabled?: boolean;
}

export function StepBasicInfo({
  name,
  slug,
  tagline,
  onNameChange,
  onSlugChange,
  onTaglineChange,
  fieldErrors,
  checkingSlug,
  slugAvailable,
  disabled,
}: StepBasicInfoProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="name">Store name</FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="My Awesome Store"
          disabled={disabled}
          aria-invalid={!!fieldErrors.name}
          autoFocus
        />
        <FieldError>{fieldErrors.name}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="slug">Store URL</FieldLabel>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            kakamalem.com/store/
          </span>
          <div className="relative flex-1">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value.toLowerCase())}
              placeholder="my-store"
              disabled={disabled}
              aria-invalid={!!fieldErrors.slug}
              className="pr-8"
            />
            {checkingSlug && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>
        {checkingSlug ? (
          <FieldDescription>Checking availability...</FieldDescription>
        ) : slugAvailable === true ? (
          <FieldDescription className="text-green-600">
            This URL is available
          </FieldDescription>
        ) : slugAvailable === false ? (
          <FieldError>This URL is already taken</FieldError>
        ) : name && !slug ? (
          <FieldDescription className="text-amber-600">
            Please enter a custom URL (letters a-z, numbers, and hyphens only)
          </FieldDescription>
        ) : fieldErrors.slug ? (
          <FieldError>{fieldErrors.slug}</FieldError>
        ) : (
          <FieldDescription>
            Only lowercase letters (a-z), numbers, and hyphens allowed
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="tagline">Tagline (optional)</FieldLabel>
        <Input
          id="tagline"
          value={tagline}
          onChange={(e) => onTaglineChange(e.target.value)}
          placeholder="A short catchy phrase for your store"
          disabled={disabled}
          aria-invalid={!!fieldErrors.tagline}
        />
        <FieldDescription>
          A short phrase that describes your store
        </FieldDescription>
        <FieldError>{fieldErrors.tagline}</FieldError>
      </Field>
    </motion.div>
  );
}
