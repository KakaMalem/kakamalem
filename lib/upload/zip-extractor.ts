import JSZip from "jszip";

export type ExtractedZip = {
  csvFile: { name: string; data: ArrayBuffer } | null;
  images: Map<string, ArrayBuffer>; // filename (lowercase) -> data
  errors: string[];
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

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

    for (const [path, file] of Object.entries(zip.files)) {
      // Skip directories and macOS metadata
      if (file.dir || path.startsWith("__MACOSX/") || path.startsWith(".")) {
        continue;
      }

      const pathLower = path.toLowerCase();
      const filename = path.split("/").pop() || "";
      const filenameLower = filename.toLowerCase();

      // Skip hidden files
      if (filename.startsWith(".")) {
        continue;
      }

      // Check if file is at root level (no slash or only one level)
      const isRootLevel = !path.includes("/");

      // Find CSV/Excel at root level
      if (isRootLevel && isDataFile(filename)) {
        if (result.csvFile) {
          // Already found one, warn about multiple
          result.errors.push(
            `Multiple data files found: ${result.csvFile.name} and ${filename}. Using first one.`
          );
        } else {
          result.csvFile = {
            name: filename,
            data: await file.async("arraybuffer"),
          };
        }
        continue;
      }

      // Find images in images/ folder (or similar)
      const isInImageFolder = imageFolders.some((folder) =>
        pathLower.startsWith(folder)
      );

      if (isInImageFolder && isImageFile(filename)) {
        // Store with lowercase filename for case-insensitive matching
        result.images.set(filenameLower, await file.async("arraybuffer"));
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
