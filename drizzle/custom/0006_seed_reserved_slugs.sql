-- Seed reserved slugs for affiliate vanity URLs
-- These paths cannot be used as affiliate slugs as they conflict with existing routes

-- Create the table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS reserved_slugs (
  slug varchar(63) PRIMARY KEY NOT NULL,
  reason varchar(100),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO reserved_slugs (slug, reason) VALUES
  ('terms', 'legal page'),
  ('privacy', 'legal page'),
  ('data-deletion', 'legal page'),
  ('login', 'auth route'),
  ('signup', 'auth route'),
  ('logout', 'auth route'),
  ('confirm', 'auth route'),
  ('error', 'auth route'),
  ('dashboard', 'app route'),
  ('store', 'app route'),
  ('admin', 'app route'),
  ('invoice', 'app route'),
  ('api', 'api route'),
  ('uploads', 'file route'),
  ('~offline', 'pwa route'),
  ('_next', 'nextjs route'),
  ('affiliate', 'affiliate route'),
  ('affiliates', 'affiliate route'),
  ('become-affiliate', 'affiliate route'),
  ('sitemap.xml', 'seo route'),
  ('robots.txt', 'seo route'),
  ('favicon.ico', 'asset route'),
  ('manifest.json', 'pwa route'),
  ('sw.js', 'pwa route')
ON CONFLICT (slug) DO NOTHING;
