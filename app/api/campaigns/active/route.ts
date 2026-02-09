import { NextRequest, NextResponse } from "next/server";
import { getActiveCampaigns } from "@/lib/db/queries/campaigns";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/active?tenantId={tenantId}
 * Returns active campaigns for a store (for client-side discount calculations)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    const campaigns = await getActiveCampaigns(tenantId);

    // Return only the fields needed for discount calculations
    const simplifiedCampaigns = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      discountType: c.discountType,
      discountValue: c.discountValue,
      scope: c.scope,
      eligibleCategories: c.eligibleCategories,
      eligibleProducts: c.eligibleProducts,
      excludedProducts: c.excludedProducts,
      showBadge: c.showBadge,
      badgeText: c.badgeText,
      priority: c.priority,
    }));

    return NextResponse.json({ campaigns: simplifiedCampaigns });
  } catch (error) {
    console.error("Failed to fetch active campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
