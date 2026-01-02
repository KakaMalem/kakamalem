import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getInventoryMovements } from "@/lib/db/queries/inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  History,
} from "lucide-react";

interface InventoryHistoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    type?: string;
    productId?: string;
  }>;
}

const movementTypeLabels: Record<string, string> = {
  adjustment: "Manual Adjustment",
  sale: "Sale",
  return: "Return",
  restock: "Restock",
  reserved: "Reserved",
  released: "Released",
};

const movementTypeColors: Record<string, string> = {
  adjustment: "bg-blue-100 text-blue-800",
  sale: "bg-red-100 text-red-800",
  return: "bg-green-100 text-green-800",
  restock: "bg-green-100 text-green-800",
  reserved: "bg-yellow-100 text-yellow-800",
  released: "bg-gray-100 text-gray-800",
};

export default async function InventoryHistoryPage({
  params,
  searchParams,
}: InventoryHistoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const page = parseInt(search.page || "1");

  const { movements, pagination } = await getInventoryMovements(store.id, {
    page,
    limit: 20,
    type: search.type,
    productId: search.productId,
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inventory History
          </h1>
          <p className="text-muted-foreground">
            View all stock changes and adjustments.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/${slug}/inventory`}>
            <ChevronLeft className="mr-2 size-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!search.type ? "secondary" : "outline"}
          size="sm"
          asChild
        >
          <Link href={`/dashboard/${slug}/inventory/history`}>All</Link>
        </Button>
        {Object.entries(movementTypeLabels).map(([type, label]) => (
          <Button
            key={type}
            variant={search.type === type ? "secondary" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/dashboard/${slug}/inventory/history?type=${type}`}>
              {label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Movements List */}
      {movements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="mb-4 size-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No inventory movements</h3>
            <p className="text-center text-muted-foreground">
              {search.type
                ? `No ${movementTypeLabels[
                    search.type
                  ]?.toLowerCase()} movements found.`
                : "Stock changes will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movements.map((movement) => (
            <Card key={movement.id}>
              <CardContent className="flex items-center gap-4 p-4">
                {/* Movement Icon */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    movement.quantity > 0
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {movement.quantity > 0 ? (
                    <ArrowUp className="size-5" />
                  ) : (
                    <ArrowDown className="size-5" />
                  )}
                </div>

                {/* Movement Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/${slug}/products/${movement.productId}`}
                      className="font-medium hover:underline"
                    >
                      {movement.productName}
                    </Link>
                    {movement.variantDisplayName && (
                      <Badge variant="outline" className="text-xs">
                        {movement.variantDisplayName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                        movementTypeColors[movement.type] || "bg-gray-100"
                      }`}
                    >
                      {movementTypeLabels[movement.type] || movement.type}
                    </span>
                    {movement.reason && <span>{movement.reason}</span>}
                    {movement.userName && <span>by {movement.userName}</span>}
                  </div>
                </div>

                {/* Stock Change */}
                <div className="shrink-0 text-right">
                  <p
                    className={`text-lg font-bold ${
                      movement.quantity > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movement.previousStock} → {movement.newStock}
                  </p>
                </div>

                {/* Date */}
                <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                  {formatDate(movement.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} movements
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              asChild={pagination.page !== 1}
            >
              {pagination.page === 1 ? (
                <>
                  <ChevronLeft className="size-4" />
                  Previous
                </>
              ) : (
                <Link
                  href={`/dashboard/${slug}/inventory/history?page=${
                    pagination.page - 1
                  }${search.type ? `&type=${search.type}` : ""}`}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Link>
              )}
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              asChild={pagination.page !== pagination.totalPages}
            >
              {pagination.page === pagination.totalPages ? (
                <>
                  Next
                  <ChevronRight className="size-4" />
                </>
              ) : (
                <Link
                  href={`/dashboard/${slug}/inventory/history?page=${
                    pagination.page + 1
                  }${search.type ? `&type=${search.type}` : ""}`}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
