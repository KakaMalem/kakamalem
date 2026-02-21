-- Migration: page_builder_v2
-- Adds multi-page support to page_layouts:
--   title        – human-readable page name shown in dashboard
--   slug         – URL path segment for /store/[storeSlug]/page/[slug]
--   is_homepage  – marks which page renders at /store/[storeSlug]/
--   display_order – sort order for nav / page list

-- 1. Add new columns (nullable first so existing rows don't fail)
ALTER TABLE "page_layouts" ADD COLUMN "title" varchar(255);
ALTER TABLE "page_layouts" ADD COLUMN "slug" varchar(255);
ALTER TABLE "page_layouts" ADD COLUMN "is_homepage" boolean;
ALTER TABLE "page_layouts" ADD COLUMN "display_order" integer;

-- 2. Back-fill existing rows
UPDATE "page_layouts"
SET
  title        = CASE page_type
                   WHEN 'homepage' THEN 'Home'
                   WHEN 'about'    THEN 'About Us'
                   WHEN 'contact'  THEN 'Contact'
                   WHEN 'faq'      THEN 'FAQ'
                   ELSE initcap(replace(page_type, '_', ' '))
                 END,
  slug         = CASE page_type
                   WHEN 'homepage' THEN 'home'
                   ELSE page_type
                 END,
  is_homepage  = (page_type = 'homepage'),
  display_order = 0;

-- 3. Make columns NOT NULL now that they're populated
ALTER TABLE "page_layouts" ALTER COLUMN "title"         SET NOT NULL;
ALTER TABLE "page_layouts" ALTER COLUMN "title"         SET DEFAULT 'Untitled';
ALTER TABLE "page_layouts" ALTER COLUMN "slug"          SET NOT NULL;
ALTER TABLE "page_layouts" ALTER COLUMN "slug"          SET DEFAULT 'home';
ALTER TABLE "page_layouts" ALTER COLUMN "is_homepage"   SET NOT NULL;
ALTER TABLE "page_layouts" ALTER COLUMN "is_homepage"   SET DEFAULT false;
ALTER TABLE "page_layouts" ALTER COLUMN "display_order" SET NOT NULL;
ALTER TABLE "page_layouts" ALTER COLUMN "display_order" SET DEFAULT 0;

-- 4. Drop old unique constraint on (tenant_id, page_type)
DROP INDEX IF EXISTS "page_layouts_tenant_page_idx";

-- 5. Add new unique constraint on (tenant_id, slug)
CREATE UNIQUE INDEX "page_layouts_tenant_slug_idx" ON "page_layouts" ("tenant_id", "slug");

-- 6. Add index for homepage lookups
CREATE INDEX "page_layouts_homepage_idx" ON "page_layouts" ("tenant_id", "is_homepage");
