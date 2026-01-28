import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// Template data with example rows (includes variant support)
const TEMPLATE_HEADERS = [
  "name",
  "price",
  "category",
  "stock",
  "status",
  "description",
  "compare_at_price",
  "cost_price",
  "sku",
  "barcode",
  "track_inventory",
  "allow_backorder",
  "low_stock_threshold",
  "show_stock",
  "weight",
  "length",
  "width",
  "height",
  "show_on_storefront",
  "show_on_pos",
  "parent_product", // For variants: name of the parent product
  "option_size", // Example option column - add more as needed (option_color, etc.)
  "option_color", // Example option column
];

// Example rows showing:
// - Simple product (row 1)
// - Product with multiple categories (row 2)
// - Product with variants (row 3 = parent, rows 4-7 = variants)
const EXAMPLE_ROWS = [
  // Simple product without variants
  [
    "Simple Product",
    "1500",
    "Electronics; Accessories", // Multiple categories example
    "100",
    "draft",
    "A great product description",
    "2000",
    "1000",
    "SIMPLE-001",
    "123456789",
    "true",
    "false",
    "10",
    "false",
    "0.5",
    "10",
    "5",
    "3",
    "true",
    "true",
    "", // parent_product empty = main product
    "", // option_size empty for non-variant
    "", // option_color empty for non-variant
  ],
  // Product with variants - PARENT (no option values, no stock on parent)
  [
    "T-Shirt with Variants",
    "500",
    "Clothing",
    "0", // Parent stock is 0, variants have their own stock
    "active",
    "A stylish t-shirt available in multiple sizes and colors",
    "750",
    "250",
    "", // Parent can have empty SKU
    "",
    "true",
    "false",
    "5",
    "false",
    "0.2",
    "",
    "",
    "",
    "true",
    "true",
    "", // parent_product empty = main product
    "", // Empty options for parent
    "",
  ],
  // Variant 1: Small Blue
  [
    "T-Shirt - Small / Blue",
    "500",
    "", // Variants don't need category
    "25",
    "",
    "",
    "",
    "",
    "TSHIRT-S-BLU",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "T-Shirt with Variants", // Links to parent product by name
    "Small", // option_size value
    "Blue", // option_color value
  ],
  // Variant 2: Small Red
  [
    "T-Shirt - Small / Red",
    "500",
    "",
    "30",
    "",
    "",
    "",
    "",
    "TSHIRT-S-RED",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "T-Shirt with Variants",
    "Small",
    "Red",
  ],
  // Variant 3: Medium Blue
  [
    "T-Shirt - Medium / Blue",
    "500",
    "",
    "20",
    "",
    "",
    "",
    "",
    "TSHIRT-M-BLU",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "T-Shirt with Variants",
    "Medium",
    "Blue",
  ],
  // Variant 4: Large Blue (different price)
  [
    "T-Shirt - Large / Blue",
    "550", // Variants can have different prices
    "",
    "15",
    "",
    "",
    "",
    "275",
    "TSHIRT-L-BLU",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "T-Shirt with Variants",
    "Large",
    "Blue",
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

  // Set column widths for better readability
  worksheet["!cols"] = [
    { wch: 30 }, // name
    { wch: 10 }, // price
    { wch: 20 }, // category
    { wch: 8 }, // stock
    { wch: 10 }, // status
    { wch: 35 }, // description
    { wch: 15 }, // compare_at_price
    { wch: 12 }, // cost_price
    { wch: 15 }, // sku
    { wch: 15 }, // barcode
    { wch: 15 }, // track_inventory
    { wch: 15 }, // allow_backorder
    { wch: 18 }, // low_stock_threshold
    { wch: 12 }, // show_stock
    { wch: 8 }, // weight
    { wch: 8 }, // length
    { wch: 8 }, // width
    { wch: 8 }, // height
    { wch: 18 }, // show_on_storefront
    { wch: 12 }, // show_on_pos
    { wch: 25 }, // parent_product
    { wch: 12 }, // option_size
    { wch: 12 }, // option_color
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  if (format === "xlsx") {
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
    // Generate CSV with UTF-8 BOM for proper encoding in Excel (supports Persian, Arabic, etc.)
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
