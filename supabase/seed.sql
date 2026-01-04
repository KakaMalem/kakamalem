-- ============================================================================
-- STORAGE BUCKETS SETUP
-- ============================================================================
-- This file creates the storage buckets needed for the application.
-- Run automatically by Supabase on local startup.

-- Create public bucket for all media (products, categories, store branding)
-- This is the centralized media library matching the 'media' database table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES FOR MEDIA BUCKET
-- ============================================================================
-- Files are organized by tenant ID: media/{tenant_id}/{filename}
-- Users must be members of the tenant to manage that tenant's media

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

-- Anyone can view media (public bucket)
CREATE POLICY "Public can view media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'media');

-- Authenticated users can upload media (tenant access will be checked by application)
CREATE POLICY "Authenticated can upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- Authenticated users can update media (tenant access will be checked by application)
CREATE POLICY "Authenticated can update media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media');

-- Authenticated users can delete media (tenant access will be checked by application)
CREATE POLICY "Authenticated can delete media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');
