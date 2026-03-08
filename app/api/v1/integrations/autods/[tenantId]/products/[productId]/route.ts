import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { updateAutoDSProduct } from "@/lib/integrations/autods-mapper";
import { verifyApiKey } from "@/lib/integrations/verify-api-key";
import {
  checkRateLimit,
  validateBody,
} from "@/lib/integrations/api-middleware";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const PutProductSchema = z
  .object({
    price: z.number().nonnegative().optional(),
    cost_price: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    sku: z.string().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message:
      "At least one field must be provided: price, cost_price, stock, title, description, status, sku",
  });

/**
 * PUT /api/v1/integrations/autods/[tenantId]/products/[productId]
 *
 * AutoDS calls this to update price, stock, status, or other fields
 * of an existing product. Partial updates are supported.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; productId: string }> }
) {
  const { tenantId, productId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "PUT /products/:id");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await validateBody(req, PutProductSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  try {
    const result = await updateAutoDSProduct(tenantId, productId, body);

    if (!result.success) {
      const statusCode =
        ("status" in result ? (result as { status: number }).status : 400) ||
        400;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      message: "Product updated successfully.",
      id: result.id,
    });
  } catch (error) {
    console.error("AutoDS PUT /products/:id Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/integrations/autods/[tenantId]/products/[productId]
 *
 * AutoDS calls this to archive/remove a product from the Kaka Malem store.
 * Soft-deletes by setting status to "archived".
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; productId: string }> }
) {
  const { tenantId, productId } = await params;

  const rateLimitError = checkRateLimit(tenantId, "DELETE /products/:id");
  if (rateLimitError) return rateLimitError;

  if (!(await verifyApiKey(tenantId, req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await updateAutoDSProduct(tenantId, productId, {
      status: "archived",
    });

    if (!result.success) {
      const statusCode =
        ("status" in result ? (result as { status: number }).status : 400) ||
        400;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({
      success: true,
      message: "Product archived successfully.",
      id: result.id,
    });
  } catch (error) {
    console.error("AutoDS DELETE /products/:id Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
