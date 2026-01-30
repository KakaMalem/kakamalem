"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, UserCheck } from "lucide-react";
import type { AnalyticsKPIs } from "@/lib/db/queries/analytics";

interface CustomerSplitCardProps {
  kpis: AnalyticsKPIs;
}

export function CustomerSplitCard({ kpis }: CustomerSplitCardProps) {
  const total = kpis.newCustomers + kpis.returningCustomers;
  const newPercent = total > 0 ? (kpis.newCustomers / total) * 100 : 0;
  const returningPercent =
    total > 0 ? (kpis.returningCustomers / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Customer Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No customer data for this period.
          </p>
        ) : (
          <>
            {/* Progress bar */}
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${newPercent}%` }}
              />
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{kpis.newCustomers}</p>
                  <p className="text-xs text-muted-foreground">
                    New (
                    {Number.isFinite(newPercent) ? newPercent.toFixed(0) : 0}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {kpis.returningCustomers}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Returning (
                    {Number.isFinite(returningPercent)
                      ? returningPercent.toFixed(0)
                      : 0}
                    %)
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
