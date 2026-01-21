import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { readdir, stat, unlink, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// =============================================================================
// Types
// =============================================================================

interface FileOnDisk {
  path: string; // Relative path from storage root
  url: string; // URL as stored in DB
  size: number;
  mtime: Date;
  tenantId: string | null;
  folder: string | null;
}

interface StorageTenantStats {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  filesOnDisk: number;
  filesInDb: number;
  orphanedFiles: number;
  totalSizeOnDisk: number;
  orphanedSize: number;
}

interface StorageAnalytics {
  timestamp: string;
  summary: {
    totalFilesOnDisk: number;
    totalFilesInDb: number;
    orphanedFiles: number;
    totalStorageUsed: number;
    orphanedStorageUsed: number;
    tenantCount: number;
  };
  byTenant: StorageTenantStats[];
  orphanedFilesList: Array<{
    path: string;
    size: number;
    mtime: string;
    tenantId: string | null;
  }>;
  tempFiles: Array<{
    path: string;
    size: number;
    mtime: string;
  }>;
}

// =============================================================================
// Config
// =============================================================================

const STORAGE_ROOT = process.env.STORAGE_PATH || "/var/www/kakamalem-uploads";
const PUBLIC_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || "/uploads";
// Cross-platform temp directory
const TEMP_DIR = join(tmpdir(), "kakamalem-uploads");

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function isAdmin(userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT platform_role FROM user_profiles WHERE user_id = ${userId}
  `);
  const role = (result[0] as { platform_role?: string })?.platform_role;
  return role === "platform_admin" || role === "super_admin";
}

async function scanDirectory(
  dirPath: string,
  basePath: string = ""
): Promise<FileOnDisk[]> {
  const files: FileOnDisk[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await scanDirectory(fullPath, relativePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        try {
          const stats = await stat(fullPath);

          // Parse tenant ID from path: tenants/{tenantId}/{folder}/filename
          let tenantId: string | null = null;
          let folder: string | null = null;
          const pathParts = relativePath.split("/");

          if (pathParts[0] === "tenants" && pathParts.length >= 3) {
            tenantId = pathParts[1];
            if (pathParts.length >= 4) {
              folder = pathParts[2];
            }
          }

          files.push({
            path: relativePath,
            url: `${PUBLIC_URL}/${relativePath}`,
            size: stats.size,
            mtime: stats.mtime,
            tenantId,
            folder,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

async function getMediaUrlsFromDb(): Promise<Set<string>> {
  // Get all media URLs from the database
  // Note: categories.image_id references media.id, so we only need to check the media table
  // Tenants have logo_url and favicon_url as direct URLs
  const result = await db.execute(sql`
    SELECT url FROM media
    UNION ALL
    SELECT logo_url AS url FROM tenants WHERE logo_url IS NOT NULL
    UNION ALL
    SELECT favicon_url AS url FROM tenants WHERE favicon_url IS NOT NULL
  `);

  const urls = new Set<string>();
  for (const row of result as unknown as Array<{ url: string }>) {
    if (row.url) urls.add(row.url);
  }

  return urls;
}

async function getTenantInfo(): Promise<
  Map<string, { name: string; slug: string }>
> {
  const result = await db.execute(sql`
    SELECT id, name, slug FROM tenants
  `);

  const tenants = new Map<string, { name: string; slug: string }>();
  for (const row of result as unknown as Array<{
    id: string;
    name: string;
    slug: string;
  }>) {
    tenants.set(row.id, { name: row.name, slug: row.slug });
  }

  return tenants;
}

async function scanTempDirectory(): Promise<
  Array<{ path: string; size: number; mtime: Date }>
> {
  const tempFiles: Array<{ path: string; size: number; mtime: Date }> = [];

  // Check if temp directory exists
  if (!(await directoryExists(TEMP_DIR))) {
    return tempFiles;
  }

  try {
    const entries = await readdir(TEMP_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = join(TEMP_DIR, entry.name);
        try {
          const stats = await stat(fullPath);
          tempFiles.push({
            path: fullPath,
            size: stats.size,
            mtime: stats.mtime,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // Temp directory can't be read
  }

  return tempFiles;
}

// =============================================================================
// GET - Analyze storage and find orphans
// =============================================================================

export async function GET(): Promise<
  NextResponse<StorageAnalytics | { error: string }>
> {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if storage directory exists
    const storageExists = await directoryExists(STORAGE_ROOT);

    // Scan storage directory (returns empty array if doesn't exist)
    const filesOnDisk = storageExists ? await scanDirectory(STORAGE_ROOT) : [];

    // Get all media URLs from database
    const dbUrls = await getMediaUrlsFromDb();

    // Get tenant info
    const tenantInfo = await getTenantInfo();

    // Find orphaned files (on disk but not in DB)
    const orphanedFiles: FileOnDisk[] = [];
    for (const file of filesOnDisk) {
      if (!dbUrls.has(file.url)) {
        // Check if it's a thumbnail (ends with _small.webp, _medium.webp, _large.webp)
        const isThumbnail = /_(?:small|medium|large)\.webp$/.test(file.path);
        if (!isThumbnail) {
          orphanedFiles.push(file);
        } else {
          // For thumbnails, check if the original exists in DB
          const originalUrl = file.url
            .replace(/_small\.webp$/, ".webp")
            .replace(/_medium\.webp$/, ".webp")
            .replace(/_large\.webp$/, ".webp");
          if (!dbUrls.has(originalUrl)) {
            // Also check non-webp originals
            const nonWebpOriginal = originalUrl.replace(/\.webp$/, ".jpg");
            if (
              !dbUrls.has(nonWebpOriginal) &&
              !dbUrls.has(originalUrl.replace(/\.webp$/, ".png"))
            ) {
              orphanedFiles.push(file);
            }
          }
        }
      }
    }

    // Calculate per-tenant stats
    const tenantStats = new Map<string, StorageTenantStats>();

    for (const file of filesOnDisk) {
      const tenantId = file.tenantId || "unknown";
      const info = tenantInfo.get(tenantId);

      if (!tenantStats.has(tenantId)) {
        tenantStats.set(tenantId, {
          tenantId,
          tenantName: info?.name || "Unknown",
          tenantSlug: info?.slug || "unknown",
          filesOnDisk: 0,
          filesInDb: 0,
          orphanedFiles: 0,
          totalSizeOnDisk: 0,
          orphanedSize: 0,
        });
      }

      const stats = tenantStats.get(tenantId)!;
      stats.filesOnDisk++;
      stats.totalSizeOnDisk += file.size;

      if (dbUrls.has(file.url)) {
        stats.filesInDb++;
      }
    }

    // Count orphaned files per tenant
    for (const file of orphanedFiles) {
      const tenantId = file.tenantId || "unknown";
      const stats = tenantStats.get(tenantId);
      if (stats) {
        stats.orphanedFiles++;
        stats.orphanedSize += file.size;
      }
    }

    // Scan temp directory
    const tempFiles = await scanTempDirectory();

    // Build response
    const totalSizeOnDisk = filesOnDisk.reduce((sum, f) => sum + f.size, 0);
    const orphanedSize = orphanedFiles.reduce((sum, f) => sum + f.size, 0);

    const analytics: StorageAnalytics = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFilesOnDisk: filesOnDisk.length,
        totalFilesInDb: dbUrls.size,
        orphanedFiles: orphanedFiles.length,
        totalStorageUsed: totalSizeOnDisk,
        orphanedStorageUsed: orphanedSize,
        tenantCount: tenantStats.size,
      },
      byTenant: Array.from(tenantStats.values()).sort(
        (a, b) => b.totalSizeOnDisk - a.totalSizeOnDisk
      ),
      orphanedFilesList: orphanedFiles.slice(0, 100).map((f) => ({
        path: f.path,
        size: f.size,
        mtime: f.mtime.toISOString(),
        tenantId: f.tenantId,
      })),
      tempFiles: tempFiles.map((f) => ({
        path: f.path,
        size: f.size,
        mtime: f.mtime.toISOString(),
      })),
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Storage analytics error:", error);
    return NextResponse.json(
      {
        error: `Failed to analyze storage: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Cleanup orphaned files
// =============================================================================

interface CleanupRequest {
  action: "cleanup-orphans" | "cleanup-temp" | "cleanup-all";
  dryRun?: boolean;
}

interface CleanupResult {
  action: string;
  dryRun: boolean;
  filesDeleted: number;
  bytesReclaimed: number;
  errors: string[];
  deletedPaths: string[];
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CleanupResult | { error: string }>> {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as CleanupRequest;
  const { action, dryRun = true } = body;

  const result: CleanupResult = {
    action,
    dryRun,
    filesDeleted: 0,
    bytesReclaimed: 0,
    errors: [],
    deletedPaths: [],
  };

  if (action === "cleanup-orphans" || action === "cleanup-all") {
    // Scan for orphans
    const filesOnDisk = await scanDirectory(STORAGE_ROOT);
    const dbUrls = await getMediaUrlsFromDb();

    for (const file of filesOnDisk) {
      if (!dbUrls.has(file.url)) {
        // Skip thumbnails if original exists
        const isThumbnail = /_(?:small|medium|large)\.webp$/.test(file.path);
        if (isThumbnail) {
          const originalUrl = file.url
            .replace(/_small\.webp$/, ".webp")
            .replace(/_medium\.webp$/, ".webp")
            .replace(/_large\.webp$/, ".webp");
          if (dbUrls.has(originalUrl)) continue;
        }

        const fullPath = join(STORAGE_ROOT, file.path);

        if (dryRun) {
          result.filesDeleted++;
          result.bytesReclaimed += file.size;
          result.deletedPaths.push(file.path);
        } else {
          try {
            await unlink(fullPath);
            result.filesDeleted++;
            result.bytesReclaimed += file.size;
            result.deletedPaths.push(file.path);
          } catch (err) {
            result.errors.push(
              `Failed to delete ${file.path}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }
      }
    }
  }

  if (action === "cleanup-temp" || action === "cleanup-all") {
    const tempFiles = await scanTempDirectory();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const file of tempFiles) {
      // Only delete temp files older than 1 hour
      if (file.mtime.getTime() < oneHourAgo) {
        if (dryRun) {
          result.filesDeleted++;
          result.bytesReclaimed += file.size;
          result.deletedPaths.push(file.path);
        } else {
          try {
            await unlink(file.path);
            result.filesDeleted++;
            result.bytesReclaimed += file.size;
            result.deletedPaths.push(file.path);
          } catch (err) {
            result.errors.push(
              `Failed to delete ${file.path}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }
      }
    }
  }

  // Limit deleted paths in response
  if (result.deletedPaths.length > 50) {
    result.deletedPaths = [
      ...result.deletedPaths.slice(0, 50),
      `... and ${result.deletedPaths.length - 50} more`,
    ];
  }

  return NextResponse.json(result);
}

// =============================================================================
// DELETE - Delete specific orphaned files
// =============================================================================

interface DeleteRequest {
  paths: string[];
}

export async function DELETE(
  request: NextRequest
): Promise<
  NextResponse<{ deleted: number; errors: string[] } | { error: string }>
> {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as DeleteRequest;
  const { paths } = body;

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 });
  }

  // Security: verify paths are within storage root and not in DB
  const dbUrls = await getMediaUrlsFromDb();
  const errors: string[] = [];
  let deleted = 0;

  for (const path of paths) {
    // Sanitize path - prevent directory traversal
    if (path.includes("..") || path.startsWith("/")) {
      errors.push(`Invalid path: ${path}`);
      continue;
    }

    const url = `${PUBLIC_URL}/${path}`;
    if (dbUrls.has(url)) {
      errors.push(`File is in database, not orphaned: ${path}`);
      continue;
    }

    const fullPath = join(STORAGE_ROOT, path);

    try {
      await unlink(fullPath);
      deleted++;
    } catch (err) {
      errors.push(
        `Failed to delete ${path}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return NextResponse.json({ deleted, errors });
}
