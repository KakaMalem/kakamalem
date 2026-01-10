import { NextRequest, NextResponse } from "next/server";
import { stat, readFile } from "fs/promises";
import { resolve, extname } from "path";

// =============================================================================
// FILE SERVING API ROUTE
// =============================================================================
// Serves uploaded files from local NVMe storage
// URL: /uploads/tenants/{tenantId}/{folder}/{filename}
//
// IMPORTANT: Storage path is EXTERNAL to the project (survives deploys)
// Default: /var/www/kakamalem-uploads (NOT inside /var/www/kakamalem/)
// =============================================================================

const STORAGE_ROOT = process.env.STORAGE_PATH || "/var/www/kakamalem-uploads";

// Simple MIME type lookup by extension (no external dependency)
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

// Cache headers for different file types
const CACHE_HEADERS = {
  images: "public, max-age=31536000, immutable", // 1 year for images
  documents: "public, max-age=86400", // 1 day for documents
  default: "public, max-age=3600", // 1 hour default
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const relativePath = path.join("/");
    const fullPath = resolve(STORAGE_ROOT, relativePath);

    // Security: Prevent path traversal attacks
    // Use resolve() for absolute paths and normalize for comparison
    const normalizedRoot = resolve(STORAGE_ROOT);
    const normalizedFull = resolve(fullPath);

    if (!normalizedFull.startsWith(normalizedRoot)) {
      console.error("Path traversal blocked:", {
        normalizedFull,
        normalizedRoot,
      });
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check if file exists
    try {
      await stat(fullPath);
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(fullPath);

    // Determine MIME type
    const mimeType = getMimeType(fullPath);

    // Determine cache headers based on file type
    let cacheControl = CACHE_HEADERS.default;
    if (mimeType.startsWith("image/")) {
      cacheControl = CACHE_HEADERS.images;
    } else if (
      mimeType.includes("pdf") ||
      mimeType.includes("document") ||
      mimeType.includes("spreadsheet")
    ) {
      cacheControl = CACHE_HEADERS.documents;
    }

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": cacheControl,
        // Security headers
        "X-Content-Type-Options": "nosniff",
        // For images, allow embedding
        ...(mimeType.startsWith("image/")
          ? {}
          : {
              "Content-Disposition": `inline; filename="${path[path.length - 1]}"`,
            }),
      },
    });
  } catch (error) {
    console.error("File serving error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
