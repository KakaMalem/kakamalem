/**
 * Centralized File Validation Configuration
 *
 * Single source of truth for all file validation rules across the application.
 * This is used by:
 * - Client-side validation (Dropzone, MediaSelector)
 * - Server-side validation (formidable-parser.ts)
 * - Storage layer (lib/storage/index.ts)
 */

// =============================================================================
// MIME TYPES
// =============================================================================

/** MIME types validated via magic bytes (server-side security) */
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  // SVG intentionally excluded - can contain embedded JavaScript (XSS risk)
] as const;

export const ALLOWED_DOCUMENT_MIMES = ["application/pdf"] as const;

export const ALLOWED_MIMES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_DOCUMENT_MIMES,
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];
export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIMES)[number];
export type AllowedMime = (typeof ALLOWED_MIMES)[number];

// =============================================================================
// FILE EXTENSIONS
// =============================================================================

/** File extensions for client-side validation */
export const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  // .svg intentionally excluded - can contain embedded JavaScript (XSS risk)
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
] as const;

// =============================================================================
// SIZE LIMITS
// =============================================================================

/** File size limits in bytes by folder/context */
export const MAX_SIZES = {
  products: 10 * 1024 * 1024, // 10MB
  media: 10 * 1024 * 1024, // 10MB
  logos: 2 * 1024 * 1024, // 2MB
  favicons: 512 * 1024, // 512KB
  avatars: 2 * 1024 * 1024, // 2MB
  documents: 10 * 1024 * 1024, // 10MB
  default: 5 * 1024 * 1024, // 5MB fallback
} as const;

export type FolderType = keyof typeof MAX_SIZES;

// =============================================================================
// IMAGE DIMENSIONS
// =============================================================================

/** Image dimension constraints */
export const IMAGE_DIMENSIONS = {
  maxWidth: 4096,
  maxHeight: 4096,
  minWidth: 10,
  minHeight: 10,
} as const;

// =============================================================================
// PROCESSING DEFAULTS
// =============================================================================

/** Sharp image processing configuration */
export const PROCESSING_CONFIG = {
  outputMaxWidth: 2048,
  outputMaxHeight: 2048,
  quality: {
    jpeg: 85,
    webp: 85,
    png: 85,
  },
  thumbnails: {
    small: { width: 150, height: 150 },
    medium: { width: 400, height: 400 },
    large: { width: 800, height: 800 },
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get max file size for a folder type
 */
export function getMaxSize(folder?: string): number {
  if (!folder) return MAX_SIZES.default;
  return MAX_SIZES[folder as FolderType] ?? MAX_SIZES.default;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMime(mime: string, imageOnly = false): boolean {
  if (imageOnly) {
    return ALLOWED_IMAGE_MIMES.includes(mime as AllowedImageMime);
  }
  return ALLOWED_MIMES.includes(mime as AllowedMime);
}

/**
 * Check if file extension is allowed
 */
export function isAllowedExtension(filename: string, imageOnly = false): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (imageOnly) {
    return ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]);
  }
  return (
    ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]) ||
    ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])
  );
}

/**
 * Get accept string for file input
 */
export function getAcceptString(imageOnly = true): string {
  if (imageOnly) {
    return "image/jpeg,image/png,image/webp,image/gif,image/avif";
  }
  return "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf";
}

/**
 * Validate a file (client-side validation)
 */
export function validateFile(
  file: File,
  options: {
    folder?: string;
    imageOnly?: boolean;
    maxSize?: number;
  } = {}
): { valid: boolean; error?: string } {
  const { folder, imageOnly = true, maxSize } = options;

  // Check file type
  if (imageOnly && !file.type.startsWith("image/")) {
    return { valid: false, error: "Only image files are allowed" };
  }

  if (!isAllowedMime(file.type, imageOnly)) {
    return { valid: false, error: `File type ${file.type} is not allowed` };
  }

  // Check extension as additional safety
  if (!isAllowedExtension(file.name, imageOnly)) {
    return { valid: false, error: "File extension is not allowed" };
  }

  // Check file size
  const limit = maxSize ?? getMaxSize(folder);
  if (file.size > limit) {
    return {
      valid: false,
      error: `File must be less than ${formatFileSize(limit)}`,
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  options: {
    folder?: string;
    imageOnly?: boolean;
    maxSize?: number;
    maxFiles?: number;
  } = {}
): { valid: File[]; invalid: { file: File; error: string }[] } {
  const { maxFiles } = options;

  if (maxFiles && files.length > maxFiles) {
    return {
      valid: [],
      invalid: files.map((file) => ({
        file,
        error: `Maximum ${maxFiles} files allowed`,
      })),
    };
  }

  const valid: File[] = [];
  const invalid: { file: File; error: string }[] = [];

  for (const file of files) {
    const result = validateFile(file, options);
    if (result.valid) {
      valid.push(file);
    } else {
      invalid.push({ file, error: result.error! });
    }
  }

  return { valid, invalid };
}
