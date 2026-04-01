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
  "parent_product", // For variants: name of the parent product
  "option_size", // Example option column - add more as needed
  "option_color", // Example option column
];

// Example rows showing:
// - Simple product (row 1) - محصول ساده
// - Product with variants (row 2 = parent, rows 3-6 = variants) - محصول با واریانت
// Headers: name, price, compare_at_price, cost_price, category, description, sku, barcode,
//          weight, length, width, height, track_inventory, stock, allow_backorder,
//          low_stock_threshold, show_stock, status, show_on_storefront, show_on_pos,
//          images, parent_product, option_size, option_color
const EXAMPLE_ROWS = [
  // محصول ساده بدون واریانت - Simple product without variants
  [
    "محصول نمونه ساده", // name - نام محصول
    "1500", // price - قیمت (افغانی)
    "2000", // compare_at_price - قیمت قبلی
    "1000", // cost_price - قیمت خرید
    "لوازم الکترونیکی; لوازم جانبی", // category - دسته‌بندی (چند دسته با ; جدا می‌شوند)
    "توضیحات کامل محصول - این محصول نمونه برای آموزش آپلود گروهی است.", // description - توضیحات
    "SIMPLE-001", // sku - کد محصول
    "1234567890123", // barcode - بارکد
    "0.5", // weight - وزن (کیلوگرم)
    "10", // length - طول (سانتی‌متر)
    "5", // width - عرض (سانتی‌متر)
    "3", // height - ارتفاع (سانتی‌متر)
    "true", // track_inventory - پیگیری موجودی
    "100", // stock - تعداد موجودی
    "false", // allow_backorder - سفارش پیش‌خرید
    "10", // low_stock_threshold - آستانه کم‌موجودی
    "true", // show_stock - نمایش موجودی
    "active", // status - وضعیت
    "true", // show_on_storefront - نمایش در فروشگاه
    "true", // show_on_pos - نمایش در صندوق
    "1", // min_order_quantity - حداقل سفارش
    "50", // max_order_quantity - حداکثر سفارش
    "1", // display_order - ترتیب نمایش
    "https://example.com/product", // source_url
    "EXT-001", // source_id
    "product1.jpg", // images - تصاویر
    "", // parent_product - محصول والد (خالی = محصول اصلی)
    "", // option_size - سایز (خالی برای محصول بدون واریانت)
    "", // option_color - رنگ (خالی برای محصول بدون واریانت)
  ],
  // محصول والد با واریانت - Parent product with variants
  [
    "پتو نمونه با واریانت", // name
    "5000", // price - قیمت پایه
    "6000", // compare_at_price
    "2500", // cost_price
    "پتو و روتختی", // category
    "این محصول دارای دو رنگ (سیاه و سفید) و دو سایز (بزرگ و کوچک) می‌باشد. تصاویر همه واریانت‌ها در گالری نمایش داده می‌شود.", // description
    "BLANKET-BASE", // sku
    "", // barcode
    "0.8", // weight
    "200", // length
    "150", // width
    "5", // height
    "true", // track_inventory
    "", // stock - واریانت‌ها موجودی جداگانه دارند
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
    "blanket-main.jpg;blanket-black.jpg;blanket-white.jpg", // images - همه تصاویر برای گالری
    "", // parent_product - خالی = محصول اصلی
    "", // option_size - خالی برای والد
    "", // option_color - خالی برای والد
  ],
  // واریانت ۱: سیاه بزرگ - Variant 1: Black Large
  [
    "پتو نمونه - سیاه / بزرگ", // name
    "5500", // price - قیمت بالاتر برای سایز بزرگ
    "6500", // compare_at_price
    "2700", // cost_price
    "", // category - از والد ارث می‌برد
    "واریانت سیاه در سایز بزرگ - مناسب برای تخت دو نفره با ابعاد ۲۱۰ در ۱۶۰ سانتی‌متر", // description - توضیحات اختصاصی
    "BLANKET-BLK-L", // sku
    "1234567890124", // barcode
    "0.9", // weight - وزن بیشتر
    "210", // length
    "160", // width
    "6", // height
    "true", // track_inventory
    "25", // stock
    "true", // allow_backorder
    "5", // low_stock_threshold
    "true", // show_stock
    "active", // status
    "true", // show_on_storefront
    "true", // show_on_pos
    "", // min_order_quantity (inherits from parent usually, but could be specific)
    "",
    "1", // display_order within variants
    "",
    "",
    "blanket-black.jpg", // images - تصویر اختصاصی واریانت
    "پتو نمونه با واریانت", // parent_product - نام محصول والد
    "بزرگ", // option_size
    "سیاه", // option_color
  ],
  // واریانت ۲: سیاه کوچک - Variant 2: Black Small
  [
    "پتو نمونه - سیاه / کوچک",
    "4500", // قیمت کمتر برای سایز کوچک
    "5500",
    "2300",
    "",
    "واریانت سیاه در سایز کوچک - مناسب برای تخت یک نفره با ابعاد ۱۸۰ در ۱۴۰ سانتی‌متر",
    "BLANKET-BLK-S",
    "1234567890125",
    "0.7", // وزن کمتر
    "180",
    "140",
    "4",
    "true",
    "30",
    "false",
    "8",
    "true",
    "active",
    "true",
    "true",
    "", // min_order_quantity
    "",
    "2", // display_order
    "",
    "",
    "blanket-black.jpg",
    "پتو نمونه با واریانت",
    "کوچک",
    "سیاه",
  ],
  // واریانت ۳: سفید بزرگ - Variant 3: White Large
  [
    "پتو نمونه - سفید / بزرگ",
    "5500",
    "6500",
    "2700",
    "",
    "واریانت سفید در سایز بزرگ - رنگ روشن و شیک برای اتاق خواب مدرن",
    "BLANKET-WHT-L",
    "1234567890126",
    "0.9",
    "210",
    "160",
    "6",
    "true",
    "20",
    "true",
    "5",
    "false", // نمایش موجودی غیرفعال
    "active",
    "true",
    "false", // فقط در فروشگاه آنلاین
    "", // min_order_quantity
    "",
    "3", // display_order
    "",
    "",
    "blanket-white.jpg",
    "پتو نمونه با واریانت",
    "بزرگ",
    "سفید",
  ],
  // واریانت ۴: سفید کوچک - Variant 4: White Small
  [
    "پتو نمونه - سفید / کوچک",
    "4500",
    "5500",
    "2300",
    "",
    "واریانت سفید در سایز کوچک - سبک و راحت برای استفاده روزمره",
    "BLANKET-WHT-S",
    "1234567890127",
    "0.7",
    "180",
    "140",
    "4",
    "true",
    "35",
    "false",
    "8",
    "false", // نمایش موجودی غیرفعال
    "active",
    "false", // فقط در صندوق فروشگاه
    "true",
    "", // min_order_quantity
    "",
    "4", // display_order
    "",
    "",
    "blanket-white.jpg",
    "پتو نمونه با واریانت",
    "کوچک",
    "سفید",
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
    { wch: 30 }, // name
    { wch: 10 }, // price
    { wch: 15 }, // compare_at_price
    { wch: 12 }, // cost_price
    { wch: 25 }, // category
    { wch: 40 }, // description
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

    // Add README for the images folder (Persian)
    const readmeContent = `# راهنمای آپلود گروهی محصولات

## ساختار فایل ZIP
این فایل ZIP باید شامل موارد زیر باشد:
1. products.csv - فایل اطلاعات محصولات
2. images/ - پوشه تصاویر محصولات

## فرمت ستون تصاویر (images)
در فایل CSV، ستون images باید شامل نام فایل‌های تصویر باشد که با ; جدا شده‌اند:
- برای محصول اصلی: "main.jpg;detail1.jpg;detail2.jpg"
- برای واریانت: "variant-image.jpg"

## مثال
images/
├── product1.jpg
├── blanket-main.jpg
├── blanket-black.jpg
└── blanket-white.jpg

## نکات مهم
- نام فایل‌های تصویر به حروف کوچک و بزرگ حساس نیست
- فرمت‌های پشتیبانی شده: jpg, jpeg, png, webp, gif
- حداکثر حجم فایل ZIP: 50 مگابایت
- محصول والد باید همه تصاویر واریانت‌ها را در ستون images داشته باشد تا در گالری نمایش داده شود

## ستون‌های اختصاصی
- min_order_quantity: حداقل میزان سفارش توسط مشتری
- max_order_quantity: حداکثر میزان سفارش توسط مشتری
- display_order: اولویت نمایش محصول در لیست (عدد بزرگتر = بالاتر)
- source_url: لینک تامین‌کننده خارجی محصول
- source_id: شناسه محصول در سیستم تامین‌کننده (مثلاً کد آمازون)

## ستون‌های اختیاری واریانت
- option_size: سایز (مثلاً بزرگ، کوچک)
- option_color: رنگ (مثلاً سیاه، سفید)
- display_order: ترتیب نمایش واریانت‌ها نسبت به هم
- سایر ستون‌ها مثل قیمت و کد محصول نیز برای واریانت‌ها قابل درج هستند.
- می‌توانید ستون‌های option_ دیگری اضافه کنید (مثلاً option_material برای جنس)
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
