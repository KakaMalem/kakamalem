import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import JSZip from "jszip";

// Template data with example rows (includes variant support)
const TEMPLATE_HEADERS = [
  "name",
  "price",
  "compare_at_price",
  "cost_price",
  "category",
  "description",
  "sku",
  "barcode",
  "weight",
  "length",
  "width",
  "height",
  "track_inventory",
  "stock",
  "allow_backorder",
  "low_stock_threshold",
  "show_stock",
  "status",
  "show_on_storefront",
  "show_on_pos",
  "min_order_quantity",
  "max_order_quantity",
  "display_order",
  "source_url",
  "source_id",
  "images", // For ZIP uploads: semicolon-separated filenames from images/ folder
  "price_tiers", // Quantity pricing: "minQty-maxQty:price;..." e.g., "10-49:1200;50:1000"
  "group_pricing", // Group pricing: "groupName:price;..." e.g., "Wholesale:900;VIP:1000:1500"
  "scheduled_sale_name", // Sale name e.g., "Summer Sale"
  "scheduled_sale_price", // Sale price
  "scheduled_sale_start", // Start date: YYYY-MM-DD
  "scheduled_sale_end", // End date: YYYY-MM-DD
  "parent_product", // For variants: name of the parent product
  "option_size", // Example option column - add more as needed
  "option_color", // Example option column
];

// Example rows showing:
// - Simple product (row 1)
// - Product with variants (row 2 = parent, rows 3-6 = variants)
const EXAMPLE_ROWS = [
  // Simple product without variants
  [
    "Wireless Bluetooth Earbuds", // name
    "29.99", // price
    "49.99", // compare_at_price
    "12.50", // cost_price
    "Electronics; Audio", // category (multiple categories separated by ;)
    "High-quality wireless earbuds with noise cancellation, 24h battery life, and IPX5 water resistance.", // description
    "EARBUDS-001", // sku
    "1234567890123", // barcode
    "0.05", // weight (kg)
    "8", // length (cm)
    "6", // width (cm)
    "3", // height (cm)
    "true", // track_inventory
    "500", // stock
    "false", // allow_backorder
    "20", // low_stock_threshold
    "true", // show_stock
    "active", // status
    "true", // show_on_storefront
    "true", // show_on_pos
    "1", // min_order_quantity
    "100", // max_order_quantity
    "1", // display_order
    "https://example.com/product", // source_url
    "EXT-001", // source_id
    "earbuds-main.jpg", // images
    "10-49:24.99;50:19.99", // price_tiers (10-49 units: $24.99 | 50+: $19.99)
    "Wholesale:18.99;VIP:22.99", // group_pricing
    "Summer Sale", // scheduled_sale_name
    "19.99", // scheduled_sale_price
    "2026-06-01", // scheduled_sale_start
    "2026-06-30", // scheduled_sale_end
    "", // parent_product (empty = main product)
    "", // option_size (empty for non-variant product)
    "", // option_color (empty for non-variant product)
  ],
  // Parent product with variants
  [
    "Cotton T-Shirt", // name
    "24.99", // price (base price)
    "34.99", // compare_at_price
    "8.00", // cost_price
    "Clothing; T-Shirts", // category
    "Premium 100% cotton t-shirt available in Black and White, sizes S through L. Pre-shrunk, comfortable fit.", // description
    "TSHIRT-BASE", // sku
    "", // barcode
    "0.2", // weight
    "30", // length
    "25", // width
    "2", // height
    "true", // track_inventory
    "", // stock (variants have individual stock)
    "false", // allow_backorder
    "10", // low_stock_threshold
    "false", // show_stock
    "active", // status
    "true", // show_on_storefront
    "true", // show_on_pos
    "1", // min_order_quantity
    "", // max_order_quantity
    "2", // display_order
    "", // source_url
    "", // source_id
    "tshirt-main.jpg;tshirt-black.jpg;tshirt-white.jpg", // images (all variant images for gallery)
    "5-9:21.99;10:18.99", // price_tiers
    "Wholesale:15.99", // group_pricing
    "", // scheduled_sale_name
    "", // scheduled_sale_price
    "", // scheduled_sale_start
    "", // scheduled_sale_end
    "", // parent_product (empty = main product)
    "", // option_size (empty for parent)
    "", // option_color (empty for parent)
  ],
  // Variant 1: Black Large
  [
    "Cotton T-Shirt - Black / Large", // name
    "27.99", // price (higher for large)
    "37.99", // compare_at_price
    "9.00", // cost_price
    "", // category (inherits from parent)
    "Black cotton t-shirt in large size. Fits chest 42-44 inches.", // description
    "TSHIRT-BLK-L", // sku
    "1234567890124", // barcode
    "0.25", // weight
    "32", // length
    "27", // width
    "2", // height
    "true", // track_inventory
    "50", // stock
    "true", // allow_backorder
    "5", // low_stock_threshold
    "true", // show_stock
    "active", // status
    "true", // show_on_storefront
    "true", // show_on_pos
    "", // min_order_quantity
    "",
    "1", // display_order within variants
    "",
    "",
    "tshirt-black.jpg", // images (variant-specific image)
    "", // price_tiers (inherits from parent)
    "", // group_pricing
    "", // scheduled_sale_name
    "", // scheduled_sale_price
    "", // scheduled_sale_start
    "", // scheduled_sale_end
    "Cotton T-Shirt", // parent_product (must match parent name exactly)
    "Large", // option_size
    "Black", // option_color
  ],
  // Variant 2: Black Small
  [
    "Cotton T-Shirt - Black / Small",
    "22.99",
    "32.99",
    "7.50",
    "",
    "Black cotton t-shirt in small size. Fits chest 34-36 inches.",
    "TSHIRT-BLK-S",
    "1234567890125",
    "0.18",
    "28",
    "23",
    "2",
    "true",
    "75",
    "false",
    "10",
    "true",
    "active",
    "true",
    "true",
    "", // min_order_quantity
    "",
    "2", // display_order
    "",
    "",
    "tshirt-black.jpg",
    "", // price_tiers
    "", // group_pricing
    "", // scheduled_sale_name
    "", // scheduled_sale_price
    "", // scheduled_sale_start
    "", // scheduled_sale_end
    "Cotton T-Shirt",
    "Small",
    "Black",
  ],
  // Variant 3: White Large
  [
    "Cotton T-Shirt - White / Large",
    "27.99",
    "37.99",
    "9.00",
    "",
    "White cotton t-shirt in large size. Classic fit for everyday wear.",
    "TSHIRT-WHT-L",
    "1234567890126",
    "0.25",
    "32",
    "27",
    "2",
    "true",
    "40",
    "true",
    "5",
    "false",
    "active",
    "true",
    "false", // online only
    "", // min_order_quantity
    "",
    "3", // display_order
    "",
    "",
    "tshirt-white.jpg",
    "", // price_tiers
    "", // group_pricing
    "", // scheduled_sale_name
    "", // scheduled_sale_price
    "", // scheduled_sale_start
    "", // scheduled_sale_end
    "Cotton T-Shirt",
    "Large",
    "White",
  ],
  // Variant 4: White Small
  [
    "Cotton T-Shirt - White / Small",
    "22.99",
    "32.99",
    "7.50",
    "",
    "White cotton t-shirt in small size. Lightweight and breathable.",
    "TSHIRT-WHT-S",
    "1234567890127",
    "0.18",
    "28",
    "23",
    "2",
    "true",
    "60",
    "false",
    "10",
    "false",
    "active",
    "false", // POS only
    "true",
    "", // min_order_quantity
    "",
    "4", // display_order
    "",
    "",
    "tshirt-white.jpg",
    "", // price_tiers
    "", // group_pricing
    "", // scheduled_sale_name
    "", // scheduled_sale_price
    "", // scheduled_sale_start
    "", // scheduled_sale_end
    "Cotton T-Shirt",
    "Small",
    "White",
  ],
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";

  // Build worksheet data
  const data = [TEMPLATE_HEADERS, ...EXAMPLE_ROWS];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better readability (matching new header order)
  worksheet["!cols"] = [
    { wch: 35 }, // name
    { wch: 10 }, // price
    { wch: 15 }, // compare_at_price
    { wch: 12 }, // cost_price
    { wch: 25 }, // category
    { wch: 50 }, // description
    { wch: 15 }, // sku
    { wch: 15 }, // barcode
    { wch: 8 }, // weight
    { wch: 8 }, // length
    { wch: 8 }, // width
    { wch: 8 }, // height
    { wch: 15 }, // track_inventory
    { wch: 8 }, // stock
    { wch: 15 }, // allow_backorder
    { wch: 18 }, // low_stock_threshold
    { wch: 12 }, // show_stock
    { wch: 10 }, // status
    { wch: 18 }, // show_on_storefront
    { wch: 12 }, // show_on_pos
    { wch: 18 }, // min_order_quantity
    { wch: 18 }, // max_order_quantity
    { wch: 12 }, // display_order
    { wch: 25 }, // source_url
    { wch: 15 }, // source_id
    { wch: 40 }, // images
    { wch: 25 }, // price_tiers
    { wch: 25 }, // group_pricing
    { wch: 20 }, // scheduled_sale_name
    { wch: 18 }, // scheduled_sale_price
    { wch: 15 }, // scheduled_sale_start
    { wch: 15 }, // scheduled_sale_end
    { wch: 25 }, // parent_product
    { wch: 12 }, // option_size
    { wch: 12 }, // option_color
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  if (format === "zip") {
    // Generate ZIP template with CSV and sample images folder structure
    const zip = new JSZip();

    // Add CSV file with UTF-8 BOM
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const csvWithBom = "\uFEFF" + csvContent;
    zip.file("products.csv", csvWithBom);

    // Add README for the images folder
    const readmeContent = `# Bulk Product Import Guide

## ZIP File Structure
This ZIP file should contain:
1. products.csv - Product data file
2. images/ - Product images folder

## Images Column Format
In the CSV file, the images column should contain image filenames separated by ;
- For main products: "main.jpg;detail1.jpg;detail2.jpg"
- For variants: "variant-image.jpg"

## Example
images/
├── earbuds-main.jpg
├── tshirt-main.jpg
├── tshirt-black.jpg
└── tshirt-white.jpg

## Important Notes
- Image filenames are case-insensitive
- Supported formats: jpg, jpeg, png, webp, gif
- Maximum ZIP file size: 50MB
- Parent products should include all variant images in their images column for the gallery

## Column Reference
- min_order_quantity: Minimum order quantity per customer
- max_order_quantity: Maximum order quantity per customer
- display_order: Product display priority (higher = shown first)
- source_url: External supplier product link
- source_id: Product ID in supplier system

## Bulk Pricing Columns
- price_tiers: Quantity-based pricing
  Format: "minQty-maxQty:price;..." Example: "10-49:12.00;50:10.00"
  Omit maxQty for unlimited (e.g., "50:10.00" means 50+ units)
- group_pricing: Customer group pricing
  Format: "groupName:price;..." or "groupName:price:compareAtPrice;..."
  Example: "Wholesale:9.00;VIP:10.00:15.00"
- scheduled_sale_name: Sale event name (e.g., "Summer Sale")
- scheduled_sale_price: Sale price
- scheduled_sale_start: Start date (YYYY-MM-DD)
- scheduled_sale_end: End date (YYYY-MM-DD)

## Variant Columns
- option_size: Size (e.g., Small, Medium, Large)
- option_color: Color (e.g., Black, White, Red)
- display_order: Display order of variants relative to each other
- Other columns like price and SKU can also be set per-variant
- You can add more option_ columns (e.g., option_material for material type)
`;
    zip.file("README.txt", readmeContent);

    // Add empty images folder with placeholder
    zip.folder("images");
    zip.file(
      "images/.gitkeep",
      "Place your product images here. Delete this file before uploading."
    );

    // Generate ZIP buffer as nodebuffer for NextResponse compatibility
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          "attachment; filename=product-import-template.zip",
      },
    });
  } else if (format === "xlsx") {
    // Generate Excel file
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          "attachment; filename=product-import-template.xlsx",
      },
    });
  } else {
    // Generate CSV with UTF-8 BOM for proper encoding in Excel
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const csvWithBom = "\uFEFF" + csvContent;

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=product-import-template.csv",
      },
    });
  }
}
