CREATE TYPE "public"."swatch_shape" AS ENUM('rounded', 'circle');--> statement-breakpoint
CREATE TYPE "public"."swatch_size" AS ENUM('sm', 'md', 'lg');--> statement-breakpoint
ALTER TABLE "variant_options" ADD COLUMN "swatch_size" "swatch_size" DEFAULT 'md' NOT NULL;--> statement-breakpoint
ALTER TABLE "variant_options" ADD COLUMN "swatch_shape" "swatch_shape" DEFAULT 'rounded' NOT NULL;