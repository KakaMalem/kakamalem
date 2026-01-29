/**
 * Generate PWA placeholder icons
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

// Create simple placeholder icons with "KM" text
// Using SVG as source for sharp
const createIcon = async (size, filename, isMaskable = false) => {
  // For maskable icons, use a smaller safe area (80% of total size)
  const safeArea = isMaskable ? size * 0.8 : size;
  const fontSize = Math.floor(safeArea * 0.4);
  const textY = size / 2 + fontSize * 0.35;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#000000"/>
      <text
        x="${size / 2}"
        y="${textY}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#ffffff"
        text-anchor="middle"
      >KM</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, filename));

  console.log(`Created: ${filename} (${size}x${size})`);
};

// Create badge icon (smaller, simpler)
const createBadge = async (size, filename) => {
  const fontSize = Math.floor(size * 0.5);
  const textY = size / 2 + fontSize * 0.35;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#000000"/>
      <text
        x="${size / 2}"
        y="${textY}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#ffffff"
        text-anchor="middle"
      >K</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, filename));

  console.log(`Created: ${filename} (${size}x${size})`);
};

async function main() {
  // Ensure icons directory exists
  await mkdir(iconsDir, { recursive: true });

  // Generate icons
  await createIcon(192, "icon-192x192.png");
  await createIcon(512, "icon-512x512.png");
  await createIcon(512, "icon-maskable-512x512.png", true);
  await createBadge(72, "badge-72x72.png");

  console.log("\nAll icons generated successfully!");
}

main().catch(console.error);
