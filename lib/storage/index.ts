import { createReadStream, createWriteStream } from "fs";
import { mkdir, unlink, stat, readdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import crypto from "crypto";
import sharp from "sharp";

// =============================================================================
// LOCAL FILE STORAGE WITH SHARP IMAGE PROCESSING
// =============================================================================
// Stores files on local NVMe filesystem
// Organized by tenant for isolation
// Uses Sharp for image optimization and thumbnail generation
// =============================================================================

// Base directory for uploads (configure via env)
// IMPORTANT: Use a path OUTSIDE the project to survive deploys!
const STORAGE_ROOT = process.env.STORAGE_PATH || "/var/www/kakamalem-uploads";

// Public URL prefix for accessing files
const PUBLIC_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || "/uploads";

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
];
const ALLOWED_DOCUMENT_TYPES = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Image processing configuration
const IMAGE_CONFIG = {
  // Maximum dimensions for processed images
  maxWidth: 2048,
  maxHeight: 2048,
  // Thumbnail sizes
  thumbnails: {
    small: { width: 150, height: 150 },
    medium: { width: 400, height: 400 },
    large: { width: 800, height: 800 },
  },
  // Quality settings (1-100)
  quality: {
    jpeg: 85,
    webp: 85,
    png: 85,
  },
};

// =============================================================================
// TYPES
// =============================================================================

export interface UploadResult {
  success: boolean;
  path: string; // Relative path from storage root
  url: string; // Public URL
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  error?: string;
}

export interface StorageOptions {
  tenantId: string;
  folder?: string; // products, media, avatars, etc.
  generateUniqueName?: boolean;
  // Image processing options
  processImage?: boolean; // Enable Sharp processing (default: true for images)
  generateThumbnails?: boolean; // Generate thumbnail versions
  convertToWebp?: boolean; // Convert images to WebP format
  maxWidth?: number; // Override max width
  maxHeight?: number; // Override max height
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a unique filename to prevent collisions
 */
function generateUniqueFilename(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  return `${timestamp}-${random}${ext}`;
}

/**
 * Get the storage path for a tenant
 */
function getTenantPath(tenantId: string, folder?: string): string {
  const parts = [STORAGE_ROOT, "tenants", tenantId];
  if (folder) parts.push(folder);
  return join(...parts);
}

/**
 * Get the public URL for a file
 */
function getPublicUrl(relativePath: string): string {
  return `${PUBLIC_URL}/${relativePath}`;
}

/**
 * Validate file type
 */
function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = extname(filename).toLowerCase();
  return allowedTypes.includes(ext);
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

// =============================================================================
// IMAGE PROCESSING FUNCTIONS (SHARP)
// =============================================================================

/**
 * Process and optimize an image using Sharp
 */
async function processImage(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    convertToWebp?: boolean;
    quality?: number;
  } = {}
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
}> {
  const maxWidth = options.maxWidth || IMAGE_CONFIG.maxWidth;
  const maxHeight = options.maxHeight || IMAGE_CONFIG.maxHeight;
  const quality = options.quality || IMAGE_CONFIG.quality.webp;

  let processor = sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });

  // Convert to WebP if requested (better compression)
  if (options.convertToWebp) {
    processor = processor.webp({ quality });
  } else {
    // Otherwise, optimize based on input format
    const metadata = await sharp(buffer).metadata();
    switch (metadata.format) {
      case "jpeg":
      case "jpg":
        processor = processor.jpeg({ quality: IMAGE_CONFIG.quality.jpeg });
        break;
      case "png":
        processor = processor.png({ quality: IMAGE_CONFIG.quality.png });
        break;
      case "webp":
        processor = processor.webp({ quality: IMAGE_CONFIG.quality.webp });
        break;
      // GIF and SVG pass through without recompression
    }
  }

  const result = await processor.toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: result.info.format,
  };
}

/**
 * Generate thumbnails for an image
 */
async function generateThumbnails(
  buffer: Buffer,
  basePath: string,
  filename: string
): Promise<{
  small?: string;
  medium?: string;
  large?: string;
}> {
  const thumbnails: { small?: string; medium?: string; large?: string } = {};
  const ext = extname(filename);
  const nameWithoutExt = filename.replace(ext, "");

  for (const [size, dimensions] of Object.entries(IMAGE_CONFIG.thumbnails)) {
    const thumbFilename = `${nameWithoutExt}_${size}.webp`;
    const thumbPath = join(basePath, thumbFilename);

    try {
      await sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 80 })
        .toFile(thumbPath);

      thumbnails[size as keyof typeof thumbnails] = thumbFilename;
    } catch (error) {
      console.error(`Failed to generate ${size} thumbnail:`, error);
    }
  }

  return thumbnails;
}

/**
 * Get image metadata
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
} | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || "unknown",
      size: metadata.size || buffer.length,
      hasAlpha: metadata.hasAlpha || false,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN STORAGE FUNCTIONS
// =============================================================================

/**
 * Upload a file from a buffer with optional Sharp image processing
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  options: StorageOptions
): Promise<UploadResult> {
  try {
    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        path: "",
        url: "",
        filename: "",
        originalName,
        size: buffer.length,
        mimeType,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    const isImage = mimeType.startsWith("image/");
    const isSvg = mimeType === "image/svg+xml";

    // Validate file type for images
    if (isImage) {
      if (!isValidFileType(originalName, ALLOWED_IMAGE_TYPES)) {
        return {
          success: false,
          path: "",
          url: "",
          filename: "",
          originalName,
          size: buffer.length,
          mimeType,
          error: "Invalid image type",
        };
      }
    }

    // Ensure directory exists
    const tenantPath = getTenantPath(options.tenantId, options.folder);
    await ensureDir(tenantPath);

    let processedBuffer = buffer;
    let width: number | undefined;
    let height: number | undefined;
    let finalMimeType = mimeType;
    let thumbnails:
      | { small?: string; medium?: string; large?: string }
      | undefined;

    // Process images with Sharp (skip SVGs)
    if (isImage && !isSvg && options.processImage !== false) {
      try {
        const processed = await processImage(buffer, {
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          convertToWebp: options.convertToWebp,
        });

        processedBuffer = processed.buffer;
        width = processed.width;
        height = processed.height;

        // Update mime type if converted to WebP
        if (options.convertToWebp) {
          finalMimeType = "image/webp";
        }
      } catch (error) {
        console.error("Image processing failed, using original:", error);
        // Fall back to original buffer if processing fails
      }
    }

    // Generate filename (use .webp extension if converted)
    let filename =
      options.generateUniqueName !== false
        ? generateUniqueFilename(originalName)
        : originalName;

    if (options.convertToWebp && isImage && !isSvg) {
      const ext = extname(filename);
      filename = filename.replace(ext, ".webp");
    }

    // Build paths
    const filePath = join(tenantPath, filename);
    const relativePath = `tenants/${options.tenantId}${options.folder ? `/${options.folder}` : ""}/${filename}`;

    // Write processed file
    await writeFile(filePath, processedBuffer);

    // Generate thumbnails if requested
    if (isImage && !isSvg && options.generateThumbnails) {
      thumbnails = await generateThumbnails(buffer, tenantPath, filename);
    }

    return {
      success: true,
      path: relativePath,
      url: getPublicUrl(relativePath),
      filename,
      originalName,
      size: processedBuffer.length,
      mimeType: finalMimeType,
      width,
      height,
      thumbnails,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      path: "",
      url: "",
      filename: "",
      originalName,
      size: buffer.length,
      mimeType,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload from a ReadableStream (for large files)
 */
export async function uploadStream(
  stream: NodeJS.ReadableStream,
  originalName: string,
  mimeType: string,
  options: StorageOptions
): Promise<UploadResult> {
  try {
    const filename =
      options.generateUniqueName !== false
        ? generateUniqueFilename(originalName)
        : originalName;

    const tenantPath = getTenantPath(options.tenantId, options.folder);
    const filePath = join(tenantPath, filename);
    const relativePath = `tenants/${options.tenantId}${options.folder ? `/${options.folder}` : ""}/${filename}`;

    await ensureDir(tenantPath);

    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    const stats = await stat(filePath);

    return {
      success: true,
      path: relativePath,
      url: getPublicUrl(relativePath),
      filename,
      originalName,
      size: stats.size,
      mimeType,
    };
  } catch (error) {
    console.error("Stream upload error:", error);
    return {
      success: false,
      path: "",
      url: "",
      filename: "",
      originalName,
      size: 0,
      mimeType,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete a file
 */
export async function deleteFile(relativePath: string): Promise<boolean> {
  try {
    const fullPath = join(STORAGE_ROOT, relativePath);
    await unlink(fullPath);
    return true;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}

/**
 * Delete multiple files
 */
export async function deleteFiles(relativePaths: string[]): Promise<number> {
  let deleted = 0;
  for (const path of relativePaths) {
    if (await deleteFile(path)) {
      deleted++;
    }
  }
  return deleted;
}

/**
 * Get file info
 */
export async function getFileInfo(relativePath: string): Promise<{
  exists: boolean;
  size?: number;
  mtime?: Date;
}> {
  try {
    const fullPath = join(STORAGE_ROOT, relativePath);
    const stats = await stat(fullPath);
    return {
      exists: true,
      size: stats.size,
      mtime: stats.mtime,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * List files in a tenant folder
 */
export async function listFiles(
  tenantId: string,
  folder?: string
): Promise<string[]> {
  try {
    const tenantPath = getTenantPath(tenantId, folder);
    const files = await readdir(tenantPath);
    return files;
  } catch {
    return [];
  }
}

/**
 * Get a read stream for a file (for serving)
 */
export function getFileStream(relativePath: string): NodeJS.ReadableStream {
  const fullPath = join(STORAGE_ROOT, relativePath);
  return createReadStream(fullPath);
}

/**
 * Calculate storage usage for a tenant
 */
export async function getTenantStorageUsage(tenantId: string): Promise<number> {
  const tenantPath = getTenantPath(tenantId);

  async function getDirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await getDirSize(entryPath);
        } else {
          const stats = await stat(entryPath);
          size += stats.size;
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return size;
  }

  return getDirSize(tenantPath);
}

// =============================================================================
// FILE-BASED UPLOAD FUNCTIONS (FOR FORMIDABLE INTEGRATION)
// =============================================================================
// These functions process files from disk instead of memory buffers
// Used when uploads are streamed via formidable to temp directory first

/**
 * Process image from file path to file path (no buffer in memory)
 * Sharp reads directly from disk and writes directly to disk
 */
async function processImageFromFile(
  inputPath: string,
  outputPath: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    convertToWebp?: boolean;
    quality?: number;
  } = {}
): Promise<{ width: number; height: number }> {
  const maxWidth = options.maxWidth || IMAGE_CONFIG.maxWidth;
  const maxHeight = options.maxHeight || IMAGE_CONFIG.maxHeight;
  const quality = options.quality || IMAGE_CONFIG.quality.webp;

  let processor = sharp(inputPath)
    .rotate() // Auto-rotate based on EXIF
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });

  if (options.convertToWebp) {
    processor = processor.webp({ quality });
  } else {
    // Detect format from input file and apply appropriate compression
    const metadata = await sharp(inputPath).metadata();
    switch (metadata.format) {
      case "jpeg":
      case "jpg":
        processor = processor.jpeg({ quality: IMAGE_CONFIG.quality.jpeg });
        break;
      case "png":
        processor = processor.png({ quality: IMAGE_CONFIG.quality.png });
        break;
      case "webp":
        processor = processor.webp({ quality: IMAGE_CONFIG.quality.webp });
        break;
      // GIF and SVG pass through without recompression
    }
  }

  const info = await processor.toFile(outputPath);
  return { width: info.width, height: info.height };
}

/**
 * Generate thumbnails from file path (no buffer in memory)
 */
async function generateThumbnailsFromFile(
  inputPath: string,
  outputDir: string,
  filename: string
): Promise<{ small?: string; medium?: string; large?: string }> {
  const thumbnails: { small?: string; medium?: string; large?: string } = {};
  const ext = extname(filename);
  const nameWithoutExt = filename.replace(ext, "");

  for (const [size, dimensions] of Object.entries(IMAGE_CONFIG.thumbnails)) {
    const thumbFilename = `${nameWithoutExt}_${size}.webp`;
    const thumbPath = join(outputDir, thumbFilename);

    try {
      await sharp(inputPath)
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 80 })
        .toFile(thumbPath);

      thumbnails[size as keyof typeof thumbnails] = thumbFilename;
    } catch (error) {
      console.error(`Failed to generate ${size} thumbnail:`, error);
    }
  }

  return thumbnails;
}

/**
 * Upload a file from a temp file path (formidable output)
 * Reads from disk, processes with Sharp, writes to final destination
 * No large buffers in memory - ideal for bulk uploads
 *
 * @param tempFilePath - Path to the temp file created by formidable
 * @param originalName - Original filename from upload
 * @param mimeType - MIME type (already validated via magic bytes)
 * @param options - Storage options
 */
export async function uploadFromTempFile(
  tempFilePath: string,
  originalName: string,
  mimeType: string,
  options: StorageOptions
): Promise<UploadResult> {
  try {
    // Get file stats
    const stats = await stat(tempFilePath);

    // Validate file size
    if (stats.size > MAX_FILE_SIZE) {
      return {
        success: false,
        path: "",
        url: "",
        filename: "",
        originalName,
        size: stats.size,
        mimeType,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    const isImage = mimeType.startsWith("image/");
    const isSvg = mimeType === "image/svg+xml";

    // Ensure output directory exists
    const tenantPath = getTenantPath(options.tenantId, options.folder);
    await ensureDir(tenantPath);

    let width: number | undefined;
    let height: number | undefined;
    let finalMimeType = mimeType;
    let thumbnails:
      | { small?: string; medium?: string; large?: string }
      | undefined;

    // Generate unique filename
    let filename =
      options.generateUniqueName !== false
        ? generateUniqueFilename(originalName)
        : originalName;

    // Update extension if converting to WebP
    if (options.convertToWebp && isImage && !isSvg) {
      const ext = extname(filename);
      filename = filename.replace(ext, ".webp");
      finalMimeType = "image/webp";
    }

    const filePath = join(tenantPath, filename);
    const relativePath = `tenants/${options.tenantId}${options.folder ? `/${options.folder}` : ""}/${filename}`;

    // Process images with Sharp (reading from temp file, writing to final destination)
    if (isImage && !isSvg && options.processImage !== false) {
      try {
        const processed = await processImageFromFile(tempFilePath, filePath, {
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight,
          convertToWebp: options.convertToWebp,
        });
        width = processed.width;
        height = processed.height;

        // Generate thumbnails if requested (from temp file, before we delete it)
        if (options.generateThumbnails) {
          thumbnails = await generateThumbnailsFromFile(
            tempFilePath,
            tenantPath,
            filename
          );
        }
      } catch (error) {
        console.error("Image processing failed, copying original:", error);
        // Fall back to copying the original file
        await pipeline(
          createReadStream(tempFilePath),
          createWriteStream(filePath)
        );
      }
    } else {
      // Non-image or SVG: copy directly to final destination
      await pipeline(
        createReadStream(tempFilePath),
        createWriteStream(filePath)
      );
    }

    // Get final file stats
    const finalStats = await stat(filePath);

    return {
      success: true,
      path: relativePath,
      url: getPublicUrl(relativePath),
      filename,
      originalName,
      size: finalStats.size,
      mimeType: finalMimeType,
      width,
      height,
      thumbnails,
    };
  } catch (error) {
    console.error("Upload from temp file error:", error);
    return {
      success: false,
      path: "",
      url: "",
      filename: "",
      originalName,
      size: 0,
      mimeType,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Safely delete a temp file (ignore errors)
 * Used for cleanup after processing or on error
 */
export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath);
  } catch {
    // Ignore errors - file might already be deleted or never existed
  }
}

// =============================================================================
// CONSTANTS EXPORT
// =============================================================================
export const STORAGE_CONFIG = {
  root: STORAGE_ROOT,
  publicUrl: PUBLIC_URL,
  maxFileSize: MAX_FILE_SIZE,
  allowedImageTypes: ALLOWED_IMAGE_TYPES,
  allowedDocumentTypes: ALLOWED_DOCUMENT_TYPES,
};
