#!/usr/bin/env npx tsx
/**
 * Cleanup orphaned temp upload files
 *
 * This script deletes temp files that are older than MAX_AGE_MS.
 * Temp files are created by formidable during upload processing and
 * should be automatically deleted after processing. This script catches
 * any orphaned files (e.g., from crashed uploads or server restarts).
 *
 * Usage:
 *   npx tsx scripts/cleanup-temp-uploads.ts
 *
 * Recommended: Add to crontab to run hourly
 *   0 * * * * cd /var/www/kakamalem && npx tsx scripts/cleanup-temp-uploads.ts >> /var/log/kakamalem-cleanup.log 2>&1
 */

import { readdir, stat, unlink, mkdir } from "fs/promises";
import { join } from "path";

// Configuration
const TEMP_DIR = process.env.UPLOAD_TEMP_PATH || "/tmp/kakamalem-uploads";
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour - files older than this are considered orphaned

async function cleanupOrphanedTempFiles(): Promise<void> {
  const now = Date.now();
  let deletedCount = 0;
  let errorCount = 0;

  console.log(`[${new Date().toISOString()}] Starting temp file cleanup...`);
  console.log(`  Temp directory: ${TEMP_DIR}`);
  console.log(`  Max age: ${MAX_AGE_MS / 1000 / 60} minutes`);

  try {
    // Ensure temp directory exists
    await mkdir(TEMP_DIR, { recursive: true });

    // List all files in temp directory
    const files = await readdir(TEMP_DIR);
    console.log(`  Found ${files.length} files in temp directory`);

    for (const file of files) {
      const filePath = join(TEMP_DIR, file);

      try {
        const stats = await stat(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          continue;
        }

        // Check if file is older than MAX_AGE_MS
        const ageMs = now - stats.mtimeMs;
        if (ageMs > MAX_AGE_MS) {
          await unlink(filePath);
          deletedCount++;
          console.log(`  Deleted: ${file} (age: ${Math.round(ageMs / 1000 / 60)} minutes)`);
        }
      } catch (fileError) {
        errorCount++;
        console.error(`  Error processing ${file}:`, fileError);
      }
    }

    console.log(`  Cleanup complete: ${deletedCount} files deleted, ${errorCount} errors`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(`  Temp directory does not exist (nothing to clean up)`);
    } else {
      console.error("  Cleanup failed:", error);
      process.exit(1);
    }
  }
}

// Run cleanup
cleanupOrphanedTempFiles().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
