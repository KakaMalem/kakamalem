import JSZip from "jszip";

export type ExtractedZip = {
  csvFile: { name: string; data: ArrayBuffer } | null;
  images: Map<string, ArrayBuffer>; // filename (lowercase) -> data
  errors: string[];
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const MAX_TOTAL_UNCOMPRESSED_SIZE = 250 * 1024 * 1024; // 250MB limit for extracted data
const MAX_FILE_COUNT = 1000; // Limit total number of files in ZIP
const MAX_SINGLE_FILE_SIZE = 100 * 1024 * 1024; // 100MB max per file uncompressed
const MAX_COMPRESSION_RATIO = 100; // Skip files with ratio > 100 (uncompressed/compressed)

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((e) => ext.endsWith(e));
}

function isDataFile(filename: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith(".csv") || ext.endsWith(".xlsx") || ext.endsWith(".xls");
}

/**
 * Extract a ZIP file containing product data (CSV/Excel) and images
 *
 * Expected ZIP structure:
 * ```
 * products.zip
 * ├── products.csv (or .xlsx) - at root level
 * └── images/
 *     ├── image1.jpg
 *     ├── image2.png
 *     └── ...
 * ```
 *
 * The images/ folder can also be named "media/" or "photos/"
 */
export async function extractProductZip(
  zipData: ArrayBuffer
): Promise<ExtractedZip> {
  const result: ExtractedZip = {
    csvFile: null,
    images: new Map(),
    errors: [],
  };

  try {
    const zip = await JSZip.loadAsync(zipData);

    // Track valid image folders
    const imageFolders = ["images/", "media/", "photos/"];
    let totalUncompressedSize = 0;

    // First pass: validation (check file counts and approximate sizes)
    const files = Object.values(zip.files);
    if (files.length > MAX_FILE_COUNT) {
      throw new Error(`ZIP contains too many files (max ${MAX_FILE_COUNT})`);
    }

    // Pre-scan: check sizes from ZIP metadata where available
    for (const [rawPath, file] of Object.entries(zip.files)) {
      const path = rawPath.replace(/\\/g, "/");
      if (file.dir || path.startsWith("__MACOSX/") || path.startsWith(".")) {
        continue;
      }

      // Check uncompressed size from ZIP metadata (when available)
      const zipFileData = file as {
        _data?: { uncompressedSize?: number; compressedSize?: number };
      };
      const uncompressedSize = zipFileData._data?.uncompressedSize || 0;
      const compressedSize = zipFileData._data?.compressedSize || 0;

      if (uncompressedSize > MAX_SINGLE_FILE_SIZE) {
        throw new Error(
          `File ${path} is too large when extracted (max ${MAX_SINGLE_FILE_SIZE / (1024 * 1024)}MB)`
        );
      }

      if (
        compressedSize > 0 &&
        uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO
      ) {
        throw new Error(
          `Potential zip bomb detected in file ${path} (high compression ratio)`
        );
      }

      totalUncompressedSize += uncompressedSize;
      if (totalUncompressedSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
        throw new Error(
          `Total uncompressed size exceeds limit of ${MAX_TOTAL_UNCOMPRESSED_SIZE / (1024 * 1024)}MB`
        );
      }
    }

    // Second pass: extract files with post-extraction size enforcement
    // This catches cases where JSZip metadata was unavailable (sizes were 0)
    let actualExtractedSize = 0;

    for (const [rawPath, file] of Object.entries(zip.files)) {
      const path = rawPath.replace(/\\/g, "/");

      if (file.dir || path.startsWith("__MACOSX/") || path.startsWith(".")) {
        continue;
      }

      const filename = path.split("/").pop() || "";
      const filenameLower = filename.toLowerCase();
      const pathLower = path.toLowerCase();

      if (filename.startsWith(".")) {
        continue;
      }

      const isRootLevel = !path.includes("/");

      // Find CSV/Excel at root level
      if (isRootLevel && isDataFile(filename)) {
        if (result.csvFile) {
          result.errors.push(
            `Multiple data files found: ${result.csvFile.name} and ${filename}. Using first one.`
          );
        } else {
          const data = await file.async("arraybuffer");

          // Post-extraction size check
          if (data.byteLength > MAX_SINGLE_FILE_SIZE) {
            throw new Error(
              `File ${path} exceeded size limit after extraction (${(data.byteLength / (1024 * 1024)).toFixed(1)}MB)`
            );
          }
          actualExtractedSize += data.byteLength;
          if (actualExtractedSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
            throw new Error(
              `Total extracted size exceeds limit of ${MAX_TOTAL_UNCOMPRESSED_SIZE / (1024 * 1024)}MB`
            );
          }

          result.csvFile = { name: filename, data };
        }
        continue;
      }

      // Find images in images/ folder (or similar)
      const isInImageFolder = imageFolders.some((folder) =>
        pathLower.startsWith(folder)
      );

      if (isInImageFolder && isImageFile(filename)) {
        const data = await file.async("arraybuffer");

        // Post-extraction size check per file
        if (data.byteLength > MAX_SINGLE_FILE_SIZE) {
          throw new Error(
            `Image ${filename} exceeded size limit after extraction (${(data.byteLength / (1024 * 1024)).toFixed(1)}MB)`
          );
        }
        actualExtractedSize += data.byteLength;
        if (actualExtractedSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
          throw new Error(
            `Total extracted size exceeds limit of ${MAX_TOTAL_UNCOMPRESSED_SIZE / (1024 * 1024)}MB`
          );
        }

        result.images.set(filenameLower, data);
      }
    }

    // Validation
    if (!result.csvFile) {
      result.errors.push(
        "No CSV or Excel file found in ZIP root. Please include a products.csv or products.xlsx file."
      );
    }

    if (result.images.size === 0) {
      // Not an error, just informational - images are optional
      console.log(
        "No images found in ZIP. Looking for images/, media/, or photos/ folder."
      );
    }
  } catch (error) {
    result.errors.push(
      `Failed to extract ZIP: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

/**
 * Get a summary of the extracted ZIP contents
 */
export function getZipSummary(extracted: ExtractedZip): string {
  const parts: string[] = [];

  if (extracted.csvFile) {
    parts.push(`Data file: ${extracted.csvFile.name}`);
  }

  if (extracted.images.size > 0) {
    parts.push(`Images: ${extracted.images.size} files`);
  }

  if (extracted.errors.length > 0) {
    parts.push(`Errors: ${extracted.errors.length}`);
  }

  return parts.join(", ") || "Empty ZIP";
}
