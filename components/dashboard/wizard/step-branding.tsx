"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Upload, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type HeaderDisplay = "logo_only" | "name_only" | "logo_and_name";

interface StepBrandingProps {
  logoUrl: string | null;
  headerDisplay: HeaderDisplay;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onHeaderDisplayChange: (value: HeaderDisplay) => void;
  disabled?: boolean;
}

export function StepBranding({
  logoUrl,
  headerDisplay,
  onLogoUpload,
  onLogoRemove,
  onHeaderDisplayChange,
  disabled,
}: StepBrandingProps) {
  const hasLogo = !!logoUrl;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <Field>
        <FieldLabel>Store logo (optional)</FieldLabel>
        {logoUrl ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-32 h-32 mx-auto"
          >
            <Image
              src={logoUrl}
              alt="Store logo preview"
              fill
              className="rounded-lg object-contain border bg-muted/30"
              unoptimized
            />
            <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              New
            </span>
            <button
              type="button"
              onClick={onLogoRemove}
              className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors"
              disabled={disabled}
            >
              <X className="size-4" />
            </button>
          </motion.div>
        ) : (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg bg-muted/50 cursor-pointer hover:border-muted-foreground/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={onLogoUpload}
              className="sr-only"
              disabled={disabled}
            />
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload logo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG up to 2MB
            </p>
          </label>
        )}
        {logoUrl && (
          <div className="flex justify-center mt-3">
            <label>
              <input
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="sr-only"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                disabled={disabled}
              >
                <span className="cursor-pointer">
                  <Upload className="mr-2 size-4" />
                  Change Logo
                </span>
              </Button>
            </label>
          </div>
        )}
        <FieldDescription className="text-center mt-2">
          This logo will appear in your store header
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Header display</FieldLabel>
        <RadioGroup
          value={headerDisplay}
          onValueChange={(value) =>
            onHeaderDisplayChange(value as HeaderDisplay)
          }
          className="grid grid-cols-3 gap-4 mt-2"
        >
          <Label
            htmlFor="name_only"
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors",
              headerDisplay === "name_only"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/50"
            )}
          >
            <RadioGroupItem
              value="name_only"
              id="name_only"
              className="sr-only"
            />
            {headerDisplay === "name_only" && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-2 right-2"
              >
                <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              </motion.div>
            )}
            <div className="h-8 flex items-center">
              <span className="font-semibold text-sm">Store Name</span>
            </div>
            <span className="text-xs text-muted-foreground">Text only</span>
          </Label>

          <Label
            htmlFor="logo_only"
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
              !hasLogo && "cursor-not-allowed",
              hasLogo && "cursor-pointer",
              headerDisplay === "logo_only"
                ? "border-primary bg-primary/5"
                : hasLogo
                  ? "border-muted hover:border-muted-foreground/50"
                  : "border-muted"
            )}
          >
            <RadioGroupItem
              value="logo_only"
              id="logo_only"
              className="sr-only"
              disabled={!hasLogo}
            />
            {headerDisplay === "logo_only" && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-2 right-2"
              >
                <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              </motion.div>
            )}
            <div className="h-8 flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded bg-muted flex items-center justify-center",
                  !hasLogo && "opacity-50"
                )}
              >
                <span className="text-sm font-bold text-foreground">S</span>
              </div>
            </div>
            <span
              className={cn(
                "text-xs",
                !hasLogo ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              Logo only
            </span>
          </Label>

          <Label
            htmlFor="logo_and_name"
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
              !hasLogo && "cursor-not-allowed",
              hasLogo && "cursor-pointer",
              headerDisplay === "logo_and_name"
                ? "border-primary bg-primary/5"
                : hasLogo
                  ? "border-muted hover:border-muted-foreground/50"
                  : "border-muted"
            )}
          >
            <RadioGroupItem
              value="logo_and_name"
              id="logo_and_name"
              className="sr-only"
              disabled={!hasLogo}
            />
            {headerDisplay === "logo_and_name" && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-2 right-2"
              >
                <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              </motion.div>
            )}
            <div className="h-8 flex items-center gap-2">
              <div
                className={cn(
                  "w-6 h-6 rounded bg-muted flex items-center justify-center",
                  !hasLogo && "opacity-50"
                )}
              >
                <span className="text-xs font-bold text-foreground">S</span>
              </div>
              <span
                className={cn(
                  "font-semibold text-xs",
                  !hasLogo && "text-foreground/50"
                )}
              >
                Name
              </span>
            </div>
            <span
              className={cn(
                "text-xs",
                !hasLogo ? "text-muted-foreground/50" : "text-muted-foreground"
              )}
            >
              Both
            </span>
          </Label>
        </RadioGroup>
        <FieldDescription className="mt-2">
          {hasLogo
            ? "How your store name and logo appear in the header"
            : "Upload a logo to enable logo display options"}
        </FieldDescription>
      </Field>
    </motion.div>
  );
}
