"use client";

import { useMemo } from "react";
import { CalendarOff, Clock, History, Zap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SaleCard } from "./sale-card";
import type { ScheduledSale } from "@/lib/db/schema";

interface SalesListProps {
  sales: (ScheduledSale & {
    product?: {
      name: string;
      price: string;
    };
  })[];
  currency: string;
  onEdit: (sale: ScheduledSale) => void;
  onRefresh: () => void;
}

export function SalesList({
  sales,
  currency,
  onEdit,
  onRefresh,
}: SalesListProps) {
  // Categorize sales by status
  const { active, upcoming, ended } = useMemo(() => {
    const now = new Date();

    const categorized = {
      active: [] as typeof sales,
      upcoming: [] as typeof sales,
      ended: [] as typeof sales,
    };

    for (const sale of sales) {
      const startsAt = new Date(sale.startsAt);
      const endsAt = new Date(sale.endsAt);

      if (now < startsAt) {
        categorized.upcoming.push(sale);
      } else if (now > endsAt) {
        categorized.ended.push(sale);
      } else {
        categorized.active.push(sale);
      }
    }

    // Sort active and upcoming by start date (ascending)
    categorized.active.sort(
      (a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime()
    );
    categorized.upcoming.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
    // Sort ended by end date (descending - most recent first)
    categorized.ended.sort(
      (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()
    );

    return categorized;
  }, [sales]);

  if (sales.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CalendarOff className="size-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No scheduled sales</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first sale to offer time-limited discounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Sales */}
      {active.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="size-5 text-green-500" />
            <h2 className="text-lg font-semibold">Active Sales</h2>
            <span className="text-sm text-muted-foreground">
              ({active.length})
            </span>
          </div>
          <div className="space-y-3">
            {active.map((sale) => (
              <SaleCard
                key={sale.id}
                sale={sale}
                currency={currency}
                onEdit={onEdit}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Sales */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Upcoming Sales</h2>
            <span className="text-sm text-muted-foreground">
              ({upcoming.length})
            </span>
          </div>
          <div className="space-y-3">
            {upcoming.map((sale) => (
              <SaleCard
                key={sale.id}
                sale={sale}
                currency={currency}
                onEdit={onEdit}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ended Sales */}
      {ended.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <History className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              Past Sales
            </h2>
            <span className="text-sm text-muted-foreground">
              ({ended.length})
            </span>
          </div>
          <div className="space-y-3">
            {ended.slice(0, 5).map((sale) => (
              <SaleCard
                key={sale.id}
                sale={sale}
                currency={currency}
                onEdit={onEdit}
                onRefresh={onRefresh}
              />
            ))}
            {ended.length > 5 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{ended.length - 5} more past sales
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
