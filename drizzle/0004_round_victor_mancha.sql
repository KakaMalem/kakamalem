ALTER TABLE "tenants" ADD COLUMN "receipt_paper_width" varchar(10) DEFAULT '80mm' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "receipt_show_logo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "receipt_show_contact" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "receipt_footer_text" varchar(200);