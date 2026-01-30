-- Rename swatch_shape enum value from 'rounded' to 'square'
ALTER TYPE "public"."swatch_shape" RENAME VALUE 'rounded' TO 'square';--> statement-breakpoint
-- Update column default to match
ALTER TABLE "variant_options" ALTER COLUMN "swatch_shape" SET DEFAULT 'square';
