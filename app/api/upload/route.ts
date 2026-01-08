import { NextRequest, NextResponse } from "next/server";
import { uploadFromTempFile, cleanupTempFile } from "@/lib/storage";
import { parseUploadRequest } from "@/lib/upload/formidable-parser";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { tenants, tenantMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// FILE UPLOAD API ROUTE (FORMIDABLE-BASED)
// =============================================================================
// Handles file uploads from Uppy and other clients
// Uses formidable for streaming uploads (RAM efficient)
// Uses Sharp for image optimization (file-to-file, no buffer)
// =============================================================================

// Route segment config for Next.js 16+
// Disable default body parsing - formidable handles it
export const runtime = "nodejs";

// Allowed folders for uploads
const ALLOWED_FOLDERS = ["products", "media", "avatars", "logos", "documents"];

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // AUTHENTICATION
    // -------------------------------------------------------------------------
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -------------------------------------------------------------------------
    // PARSE FORM DATA WITH FORMIDABLE (streams to disk)
    // -------------------------------------------------------------------------
    // This is the key change: formidable streams the file directly to disk
    // instead of buffering in memory. Critical for bulk uploads on 16GB VPS.
    const { file, fields } = await parseUploadRequest(request);
    tempFilePath = file.filepath;

    // -------------------------------------------------------------------------
    // VALIDATE FIELDS
    // -------------------------------------------------------------------------
    if (!fields.tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_FOLDERS.includes(fields.folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}` },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // AUTHORIZATION - Check tenant access
    // -------------------------------------------------------------------------
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, fields.tenantId),
      columns: { ownerId: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Check if user is owner or member
    const isOwner = tenant.ownerId === session.user.id;
    let hasAccess = isOwner;

    if (!isOwner) {
      const membership = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, session.user.id),
        columns: { id: true },
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Not authorized to upload to this store" },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // PROCESS UPLOAD (Sharp reads from temp file, writes to final destination)
    // -------------------------------------------------------------------------
    const result = await uploadFromTempFile(
      file.filepath,
      file.originalFilename,
      file.mimetype, // Already validated via magic bytes in formidable-parser
      {
        tenantId: fields.tenantId,
        folder: fields.folder,
        generateUniqueName: true,
        processImage: true,
        convertToWebp: fields.convertToWebp,
        generateThumbnails: fields.generateThumbnails,
      }
    );

    // -------------------------------------------------------------------------
    // CLEANUP TEMP FILE
    // -------------------------------------------------------------------------
    await cleanupTempFile(file.filepath);
    tempFilePath = null; // Mark as cleaned up

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Upload failed" },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // RETURN RESPONSE (same format as before for Uppy compatibility)
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      file: {
        url: result.url,
        path: result.path,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        mimeType: result.mimeType,
        width: result.width,
        height: result.height,
        thumbnails: result.thumbnails,
      },
    });
  } catch (error) {
    // Cleanup temp file on error
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }

    console.error("Upload API error:", error);

    // Return user-friendly error messages
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("too large") ? 413 :
                   message.includes("Invalid file type") ? 415 :
                   message.includes("No file") ? 400 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

// =============================================================================
// OPTIONS for CORS (if needed)
// =============================================================================
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
