import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { syncAutoDSProduct } from "@/lib/integrations/autods-mapper";
import { verifyApiKey } from "@/lib/integrations/verify-api-key";
import {
  checkRateLimit,
  validateBody,
} from "@/lib/integrations/api-middleware";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const AutoDSVariantSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  sku: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  image: z.string().url().optional(),
});

const PostProductSchema = z
  .object({
    id: z.string().optional(),
    external_id: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    cost_price: z.number().nonnegative().optional(),
    supplier_price: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().default(0),
    sku: z.string().optional(),
    images: z.array(z.string().url()).default([]),
    variants: z.array(AutoDSVariantSchema).default([]),
  })
  .refine((d) => !!(d.id || d.external_id), {
    message: "Either 'id' or 'external_id' is required",
  })
  .refine((d) => !!(d.title || d.name), {
    message: "Either 'title' or 'name' is required",
  });

/**
 * POST /api/v1/integrations/autods/[tenantId]/products
 * AutoDS pushes a new product to Kaka Malem
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "POST /products");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await validateBody(req, PostProductSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    const result = await syncAutoDSProduct(tenantId, {
      external_id: body.id || body.external_id!,
      title: body.title || body.name!,
      description: body.description,
      price: body.price,
      cost_price: body.cost_price ?? body.supplier_price,
      stock: body.stock,
      sku: body.sku,
      images: body.images,
      variants: body.variants,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Product ${result.action} successfully.`,
      id: result.id,
    });
  } catch (error) {
    console.error("AutoDS POST /products Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/integrations/autods/[tenantId]/products
 * AutoDS checks current products in the store
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "GET /products");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const storeProducts = await db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.sourceType, "autods")
      ),
      columns: {
        id: true,
        name: true,
        price: true,
        stock: true,
        sku: true,
        status: true,
        sourceId: true,
        sourcePrice: true,
        sourceLastSyncedAt: true,
      },
      limit: 100,
    });

    return NextResponse.json({ products: storeProducts });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
