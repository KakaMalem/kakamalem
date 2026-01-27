CREATE TYPE "public"."transfer_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "store_transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"status" "transfer_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pos_scanner_mode" varchar(10) DEFAULT 'camera' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_transfer_requests" ADD CONSTRAINT "store_transfer_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transfer_requests" ADD CONSTRAINT "store_transfer_requests_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transfer_requests" ADD CONSTRAINT "store_transfer_requests_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_transfer_pending_idx" ON "store_transfer_requests" USING btree ("tenant_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "store_transfer_to_user_idx" ON "store_transfer_requests" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "store_transfer_expires_idx" ON "store_transfer_requests" USING btree ("expires_at") WHERE status = 'pending';