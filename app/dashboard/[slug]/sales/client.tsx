"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SalesList } from "@/components/dashboard/sales/sales-list";
import { ScheduledSaleForm } from "@/components/dashboard/sales/scheduled-sale-form";
import type { ScheduledSale, Product } from "@/lib/db/schema";

interface SalesClientProps {
  tenantId: string;
  currency: string;
  initialSales: (ScheduledSale & {
    product?: {
      name: string;
      price: string;
    };
  })[];
  products: Pick<Product, "id" | "name" | "price">[];
}

export function SalesClient({
  tenantId,
  currency,
  initialSales,
  products,
}: SalesClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<ScheduledSale | null>(null);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEdit = useCallback((sale: ScheduledSale) => {
    setEditingSale(sale);
    setFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingSale(null);
    setFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {initialSales.length} sale{initialSales.length !== 1 ? "s" : ""}
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          Create Sale
        </Button>
      </div>

      <SalesList
        sales={initialSales}
        currency={currency}
        onEdit={handleEdit}
        onRefresh={handleRefresh}
      />

      <ScheduledSaleForm
        tenantId={tenantId}
        currency={currency}
        products={products}
        sale={editingSale}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
