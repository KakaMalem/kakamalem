/**
 * Formidable-based file upload parser
 *
 * This module provides streaming file uploads using formidable.
 * Files are streamed directly to disk (temp directory), not buffered in RAM.
 * This is critical for handling bulk image uploads on a 16GB VPS.
 *
 * Flow:
 * 1. Web Request converted to Node.js IncomingMessage
 * 2. Formidable streams file to UPLOAD_TEMP_PATH
 * 3. MIME type validated via magic bytes (file-type package)
 * 4. Temp file path returned for processing by storage layer
 */

import formidable from "formidable";
import { IncomingMessage } from "http";
import { mkdir } from "fs/promises";
import { Readable } from "stream";
import { fileTypeFromFile } from "file-type";
import { readFile } from "fs/promises";
import { isSvgContent } from "@/lib/upload/svg-sanitizer";

import {
  ALLOWED_MIMES,
  ALLOWED_IMAGE_MIMES,
  MAX_SIZES,
} from "@/lib/config/file-validation";

// Configuration
const TEMP_DIR = process.env.UPLOAD_TEMP_PATH || "/tmp/kakamalem-uploads";
const MAX_FILE_SIZE = parseInt(
  process.env.MAX_UPLOAD_SIZE || String(MAX_SIZES.default),
  10
);

// Create Sets from centralized config for efficient lookup
// Use explicit string type since we check against strings from file-type detection
const ALLOWED_MIME_TYPES = new Set<string>(ALLOWED_MIMES);
const ALLOWED_IMAGE_TYPES = new Set<string>(ALLOWED_IMAGE_MIMES);

export interface ParsedFile {
  filepath: string;
  originalFilename: string;
  mimetype: string;
  size: number;
}

export interface ParsedFields {
  tenantId: string;
  folder: string;
  convertToWebp: boolean;
  generateThumbnails: boolean;
}

export interface ParsedUpload {
  file: ParsedFile;
  fields: ParsedFields;
}

/**
 * Ensure temp directory exists
 */
export async function ensureTempDir(): Promise<string> {
  await mkdir(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

/**
 * Parse multipart form data with formidable (streams to disk)
 *
 * @param request - Web Request object
 * @param imageOnly - If true, only allow image MIME types
 * @returns Parsed file info and form fields
 */
export async function parseUploadRequest(
  request: Request,
  imageOnly: boolean = true
): Promise<ParsedUpload> {
  // Ensure temp directory exists
  await ensureTempDir();

  // Convert Web Request to Node.js IncomingMessage
  const nodeReq = await webRequestToNode(request);

  return new Promise((resolve, reject) => {
    const form = formidable({
      uploadDir: TEMP_DIR,
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: 1,
      // Generate unique filename to avoid collisions
      filename: () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        return `upload_${timestamp}_${random}.tmp`;
      },
      filter: ({ mimetype }) => {
        // First-pass filter based on Content-Type header
        // Real validation happens after upload via magic bytes
        if (!mimetype) return false;
        return mimetype.startsWith("image/") || mimetype === "application/pdf";
      },
    });

    form.parse(nodeReq, async (err, fields, files) => {
      if (err) {
        // Handle specific formidable errors
        if (err.code === 1009) {
          reject(
            new Error(
              `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
            )
          );
        } else if (err.code === 1015) {
          reject(new Error("Too many files. Maximum is 1 file per request"));
        } else {
          reject(new Error(err.message || "Form parsing failed"));
        }
        return;
      }

      // Extract file (formidable returns array for each field)
      const fileArray = files.file;
      if (!fileArray || fileArray.length === 0) {
        reject(new Error("No file provided"));
        return;
      }

      const file = fileArray[0];

      // Validate MIME type via magic bytes (security!)
      try {
        const detectedMime = await detectMimeType(file.filepath);
        const allowedTypes = imageOnly
          ? ALLOWED_IMAGE_TYPES
          : ALLOWED_MIME_TYPES;

        if (!allowedTypes.has(detectedMime)) {
          // Clean up the temp file since we're rejecting it
          const { cleanupTempFile } = await import("@/lib/storage");
          await cleanupTempFile(file.filepath);
          reject(
            new Error(
              `Invalid file type: ${detectedMime}. Only ${imageOnly ? "images" : "images and PDFs"} are allowed.`
            )
          );
          return;
        }

        resolve({
          file: {
            filepath: file.filepath,
            originalFilename: file.originalFilename || "unknown",
            mimetype: detectedMime, // Use detected MIME, not client-provided
            size: file.size,
          },
          fields: {
            tenantId: getFieldValue(fields.tenantId) || "",
            folder: getFieldValue(fields.folder) || "media",
            convertToWebp: getFieldValue(fields.convertToWebp) === "true",
            generateThumbnails:
              getFieldValue(fields.generateThumbnails) === "true",
          },
        });
      } catch (mimeError) {
        // Clean up temp file on error
        try {
          const { cleanupTempFile } = await import("@/lib/storage");
          await cleanupTempFile(file.filepath);
        } catch {
          // Ignore cleanup errors
        }
        reject(mimeError);
      }
    });
  });
}

/**
 * Detect MIME type from file content (magic bytes)
 * This is more secure than trusting the Content-Type header
 *
 * @param filepath - Path to the file to inspect
 * @returns Detected MIME type
 */
async function detectMimeType(filepath: string): Promise<string> {
  // Use file-type package for magic byte detection (works for binary formats)
  const result = await fileTypeFromFile(filepath);

  if (result) {
    return result.mime;
  }

  // SVG detection fallback — file-type can't detect SVGs since they're XML text.
  // Read the first 500 bytes and check for SVG markers.
  // SVGs are sanitized via DOMPurify before storage (see svg-sanitizer.ts).
  try {
    const head = await readFile(filepath, { encoding: "utf-8", flag: "r" });
    if (isSvgContent(head)) {
      return "image/svg+xml";
    }
  } catch {
    // Ignore read errors — fall through to unknown
  }

  // Unknown file type
  return "application/octet-stream";
}

/**
 * Convert Web Request to Node.js IncomingMessage
 * This bridges the gap between Web API Request and Node.js streams
 *
 * @param request - Web Request object
 * @returns Node.js IncomingMessage compatible object
 */
async function webRequestToNode(request: Request): Promise<IncomingMessage> {
  // Create a readable stream from the request body
  const body = request.body;
  if (!body) {
    throw new Error("Request body is empty");
  }

  // Convert Web ReadableStream to Node.js Readable
  const readable = Readable.fromWeb(
    body as Parameters<typeof Readable.fromWeb>[0]
  );

  // Copy headers to the stream object (formidable expects this)
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // Attach request properties that formidable expects
  (readable as unknown as IncomingMessage).headers = headers;
  (readable as unknown as IncomingMessage).method = request.method;
  (readable as unknown as IncomingMessage).url = new URL(request.url).pathname;

  return readable as unknown as IncomingMessage;
}

/**
 * Helper to get first value from formidable fields
 * Formidable returns arrays for all fields
 *
 * @param field - Field value (string, array, or undefined)
 * @returns First string value or undefined
 */
function getFieldValue(
  field: string | string[] | undefined
): string | undefined {
  if (Array.isArray(field)) return field[0];
  return field;
}
