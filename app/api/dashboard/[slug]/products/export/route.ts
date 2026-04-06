import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import {
  products,
  tenants,
  variantOptions,
  priceTiers,
  customerGroupPrices,
  customerGroups,
  scheduledSales,
} from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getUser, hasStoreAccess } from "@/lib/auth/server";

// Base export headers (variant columns are dynamic based on tenant's options)
const BASE_HEADERS = [
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
  "price_tiers", // Format: minQty-maxQty:price;...
  "group_pricing", // Format: groupName:price;... or groupName:price:compareAtPrice;...
  "scheduled_sale_name",
  "scheduled_sale_price",
  "scheduled_sale_start",
  "scheduled_sale_end",
  "parent_product", // For variants: name of the parent product
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const status = searchParams.get("status"); // "archived" or null for active

    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant by slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      columns: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Check store access
    const access = await hasStoreAccess(tenant.id);
    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch all variant options for this tenant (for dynamic columns)
    const tenantVariantOptions = await db.query.variantOptions.findMany({
      where: eq(variantOptions.tenantId, tenant.id),
      columns: { id: true, name: true },
      orderBy: (vo, { asc }) => [asc(vo.displayOrder)],
    });

    // Create option name to column name mapping (e.g., "Size" -> "option_size")
    const optionColumns = tenantVariantOptions.map((opt) => ({
      id: opt.id,
      name: opt.name,
      column: `option_${opt.name.toLowerCase().replace(/\s+/g, "_")}`,
    }));

    // Build full headers with dynamic option columns
    const headers = [...BASE_HEADERS, ...optionColumns.map((o) => o.column)];

    // Fetch products with categories and variants
    const productList = await db.query.products.findMany({
      where:
        status === "archived"
          ? and(
              eq(products.tenantId, tenant.id),
              eq(products.status, "archived")
            )
          : and(
              eq(products.tenantId, tenant.id),
              ne(products.status, "archived")
            ),
      with: {
        category: {
          columns: { name: true },
        },
        productCategories: {
          with: {
            category: {
              columns: { name: true },
            },
          },
        },
        variants: {
          with: {
            options: {
              with: {
                optionValue: {
                  with: {
                    option: true,
                  },
                },
              },
            },
          },
          orderBy: (v, { asc }) => [asc(v.displayOrder)],
        },
      },
      orderBy: (products, { asc }) => [asc(products.displayOrder)],
    });

    // Fetch price tiers, group pricing, and scheduled sales in parallel
    const [
      allPriceTiers,
      allGroupPrices,
      allScheduledSales,
      allCustomerGroups,
    ] = await Promise.all([
      db.query.priceTiers.findMany({
        where: eq(priceTiers.tenantId, tenant.id),
        orderBy: (pt, { asc }) => [asc(pt.minQuantity)],
      }),
      db.query.customerGroupPrices.findMany({
        where: eq(customerGroupPrices.tenantId, tenant.id),
      }),
      db.query.scheduledSales.findMany({
        where: eq(scheduledSales.tenantId, tenant.id),
        orderBy: (ss, { desc }) => [desc(ss.priority)],
      }),
      db.query.customerGroups.findMany({
        where: eq(customerGroups.tenantId, tenant.id),
        columns: { id: true, name: true },
      }),
    ]);

    // Build lookup maps by productId
    const priceTiersByProduct = new Map<string, typeof allPriceTiers>();
    for (const pt of allPriceTiers) {
      const arr = priceTiersByProduct.get(pt.productId) || [];
      arr.push(pt);
      priceTiersByProduct.set(pt.productId, arr);
    }

    const groupNameMap = new Map(allCustomerGroups.map((g) => [g.id, g.name]));

    const groupPricesByProduct = new Map<string, typeof allGroupPrices>();
    for (const gp of allGroupPrices) {
      const arr = groupPricesByProduct.get(gp.productId) || [];
      arr.push(gp);
      groupPricesByProduct.set(gp.productId, arr);
    }

    const salesByProduct = new Map<string, typeof allScheduledSales>();
    for (const ss of allScheduledSales) {
      const arr = salesByProduct.get(ss.productId) || [];
      arr.push(ss);
      salesByProduct.set(ss.productId, arr);
    }

    if (productList.length === 0) {
      return NextResponse.json(
        { error: "No products to export" },
        { status: 404 }
      );
    }

    // Convert products to export rows
    const exportRows: (string | number)[][] = [];

    for (const product of productList) {
      // Collect all category names
      const categoryNames: string[] = [];
      if (product.productCategories && product.productCategories.length > 0) {
        for (const pc of product.productCategories) {
          if (pc.category?.name) {
            categoryNames.push(pc.category.name);
          }
        }
      }
      if (categoryNames.length === 0 && product.category?.name) {
        categoryNames.push(product.category.name);
      }
      const categoryField = categoryNames.join("; ");

      // Create base row for the product
      const baseRow = [
        product.name,
        product.price,
        categoryField,
        product.stock?.toString() || "0",
        product.status,
        product.description || "",
        product.compareAtPrice || "",
        product.costPrice || "",
        product.sku || "",
        product.barcode || "",
        product.trackInventory ? "true" : "false",
        product.allowBackorder ? "true" : "false",
        product.lowStockThreshold?.toString() || "5",
        product.showStock ? "true" : "false",
        product.weight || "",
        product.length || "",
        product.width || "",
        product.height || "",
        product.showOnStorefront ? "true" : "false",
        product.showOnPos ? "true" : "false",
        // Price tiers: "minQty-maxQty:price;..." format
        (() => {
          const tiers = priceTiersByProduct.get(product.id);
          if (!tiers || tiers.length === 0) return "";
          return tiers
            .map((t) =>
              t.maxQuantity
                ? `${t.minQuantity}-${t.maxQuantity}:${t.price}`
                : `${t.minQuantity}:${t.price}`
            )
            .join(";");
        })(),
        // Group pricing: "groupName:price;..." or "groupName:price:compareAtPrice;..."
        (() => {
          const gps = groupPricesByProduct.get(product.id);
          if (!gps || gps.length === 0) return "";
          return gps
            .map((gp) => {
              const name = groupNameMap.get(gp.customerGroupId) || "Unknown";
              return gp.compareAtPrice
                ? `${name}:${gp.price}:${gp.compareAtPrice}`
                : `${name}:${gp.price}`;
            })
            .join(";");
        })(),
        // Scheduled sale (first/highest priority)
        (() => {
          const sales = salesByProduct.get(product.id);
          return sales?.[0]?.name || "";
        })(),
        (() => {
          const sales = salesByProduct.get(product.id);
          return sales?.[0]?.salePrice || "";
        })(),
        (() => {
          const sales = salesByProduct.get(product.id);
          return sales?.[0]?.startsAt ? sales[0].startsAt.split("T")[0] : "";
        })(),
        (() => {
          const sales = salesByProduct.get(product.id);
          return sales?.[0]?.endsAt ? sales[0].endsAt.split("T")[0] : "";
        })(),
        "", // parent_product (empty for main products)
      ];

      // Add empty option columns for main product
      for (let i = 0; i < optionColumns.length; i++) {
        baseRow.push("");
      }

      // Add the main product row
      exportRows.push(baseRow);

      // Add variant rows if product has variants
      if (
        product.hasVariants &&
        product.variants &&
        product.variants.length > 0
      ) {
        for (const variant of product.variants) {
          // Build option values map for this variant
          const optionValuesMap: Record<string, string> = {};
          if (variant.options) {
            for (const opt of variant.options) {
              if (opt.optionValue?.option?.name && opt.optionValue?.value) {
                const optionName = opt.optionValue.option.name;
                optionValuesMap[optionName] = opt.optionValue.value;
              }
            }
          }

          // Create variant row
          // Note: variants inherit trackInventory, allowBackorder, lowStockThreshold from parent
          const variantRow = [
            variant.displayName || product.name, // name (variant display name)
            variant.price || product.price, // price (variant price or inherit)
            "", // category (variants don't have categories)
            variant.stock?.toString() || "0",
            product.status, // inherit status from parent
            "", // description (inherit from parent)
            variant.compareAtPrice || "",
            variant.costPrice || "",
            variant.sku || "",
            variant.barcode || "",
            "", // track_inventory (inherit from parent)
            "", // allow_backorder (inherit from parent)
            "", // low_stock_threshold (inherit from parent)
            "", // show_stock (inherit from parent)
            variant.weight || "",
            variant.length || "",
            variant.width || "",
            variant.height || "",
            "", // show_on_storefront (inherit from parent)
            "", // show_on_pos (inherit from parent)
            "", // price_tiers (inherit from parent)
            "", // group_pricing (inherit from parent)
            "", // scheduled_sale_name (inherit from parent)
            "", // scheduled_sale_price
            "", // scheduled_sale_start
            "", // scheduled_sale_end
            product.name, // parent_product - reference to parent
          ];

          // Add option values in the correct column order
          for (const optCol of optionColumns) {
            variantRow.push(optionValuesMap[optCol.name] || "");
          }

          exportRows.push(variantRow);
        }
      }
    }

    // Build worksheet data
    const data = [headers, ...exportRows];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
      { wch: 30 }, // name
      { wch: 12 }, // price
      { wch: 25 }, // category
      { wch: 8 }, // stock
      { wch: 10 }, // status
      { wch: 40 }, // description
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
      { wch: 25 }, // price_tiers
      { wch: 25 }, // group_pricing
      { wch: 20 }, // scheduled_sale_name
      { wch: 18 }, // scheduled_sale_price
      { wch: 15 }, // scheduled_sale_start
      { wch: 15 }, // scheduled_sale_end
      { wch: 25 }, // parent_product
    ];

    // Add widths for option columns
    for (let i = 0; i < optionColumns.length; i++) {
      colWidths.push({ wch: 15 });
    }

    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    // Generate filename with store name and date
    const dateStr = new Date().toISOString().split("T")[0];
    const safeStoreName = tenant.name
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    const filename = `${safeStoreName}-products-${dateStr}`;

    if (format === "xlsx") {
      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=${filename}.xlsx`,
        },
      });
    } else {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      // Add UTF-8 BOM for proper encoding in Excel (supports Persian, Arabic, etc.)
      const csvWithBom = "\uFEFF" + csvContent;

      return new NextResponse(csvWithBom, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=${filename}.csv`,
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export products" },
      { status: 500 }
    );
  }
}
