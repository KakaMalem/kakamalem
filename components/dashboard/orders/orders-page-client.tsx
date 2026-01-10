"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { OrdersFilters } from "./orders-filters";
import { OrdersList } from "./orders-list";
import { OrdersBottomBar } from "./orders-bottom-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import type {
  DashboardOrder,
  OrderCounts,
  OrderStatus,
} from "@/lib/db/queries/orders";
import { bulkUpdateOrderStatus } from "@/lib/actions/orders";
import { getValidNextStatuses } from "@/lib/validations/orders";

interface OrdersPageClientProps {
  storeSlug: string;
  tenantId: string;
  currency: string;
  orders: DashboardOrder[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  searchParams: Record<string, string | undefined>;
  currentLimit: number;
  orderCounts: OrderCounts;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

export function OrdersPageClient({
  storeSlug,
  tenantId,
  currency,
  orders,
  pagination,
  searchParams,
  currentLimit,
  orderCounts,
}: OrdersPageClientProps) {
  const router = useRouter();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Bulk status update dialog state
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState<OrderStatus | "">("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Handle selection change from OrdersList
  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  // Toggle selection mode
  const handleSelectionModeToggle = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }, [selectionMode]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  // Get valid statuses for bulk update (intersection of all selected orders)
  const getValidBulkStatuses = useCallback((): OrderStatus[] => {
    if (selectedIds.size === 0) return [];

    const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
    if (selectedOrders.length === 0) return [];

    // Find common valid next statuses
    const validStatusSets = selectedOrders.map((order) =>
      getValidNextStatuses(order.status)
    );

    // Intersect all sets
    let commonStatuses = new Set(validStatusSets[0]);
    for (let i = 1; i < validStatusSets.length; i++) {
      const currentSet = new Set(validStatusSets[i]);
      commonStatuses = new Set(
        [...commonStatuses].filter((s) => currentSet.has(s))
      );
    }

    return [...commonStatuses];
  }, [selectedIds, orders]);

  // Open bulk status dialog
  const handleOpenBulkStatusDialog = useCallback(() => {
    setBulkNewStatus("");
    setBulkStatusDialogOpen(true);
  }, []);

  // Bulk status update
  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedIds.size === 0 || !bulkNewStatus) return;

    setIsUpdating(true);
    const orderIds = Array.from(selectedIds);

    const result = await bulkUpdateOrderStatus(
      tenantId,
      orderIds,
      bulkNewStatus
    );

    if (result.success) {
      toast.success(
        `${orderIds.length} order${orderIds.length > 1 ? "s" : ""} updated to ${STATUS_LABELS[bulkNewStatus]}`
      );
      setBulkStatusDialogOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      router.refresh();
    } else {
      toast.error(result.error?.message || "Failed to update orders");
    }

    setIsUpdating(false);
  }, [selectedIds, bulkNewStatus, tenantId, router]);

  // Export orders to CSV
  const handleExport = useCallback(() => {
    // Get orders to export (selected or all visible)
    const ordersToExport =
      selectedIds.size > 0
        ? orders.filter((o) => selectedIds.has(o.id))
        : orders;

    if (ordersToExport.length === 0) {
      toast.error("No orders to export");
      return;
    }

    // Build CSV content
    const headers = [
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Status",
      "Items",
      "Subtotal",
      "Shipping",
      "Tax",
      "Discount",
      "Total",
      "City",
      "Customer Notes",
    ];

    const rows = ordersToExport.map((order) => [
      order.orderNumber,
      new Date(order.createdAt).toLocaleDateString(),
      order.customerSnapshot.name,
      order.customerSnapshot.email,
      order.customerSnapshot.phone || "",
      STATUS_LABELS[order.status],
      order.itemCount.toString(),
      order.subtotal,
      order.shippingTotal,
      order.taxTotal,
      order.discountTotal,
      order.total,
      order.shippingAddress.city || "",
      order.customerNotes?.replace(/[\n\r,]/g, " ") || "",
    ]);

    // Escape and format CSV
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // Create download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${ordersToExport.length} orders`);
  }, [orders, selectedIds]);

  const validBulkStatuses = getValidBulkStatuses();

  return (
    <>
      <div className="space-y-4 pb-36">
        {/* Filters */}
        <OrdersFilters
          storeSlug={storeSlug}
          orderCounts={orderCounts}
          currentStatus={searchParams.status}
        />

        {/* Orders List */}
        <OrdersList
          orders={orders}
          storeSlug={storeSlug}
          tenantId={tenantId}
          currency={currency}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          selectionMode={selectionMode}
        />
      </div>

      {/* Bottom Bar */}
      <OrdersBottomBar
        storeSlug={storeSlug}
        pagination={pagination}
        searchParams={searchParams}
        currentLimit={currentLimit}
        selectedCount={selectedIds.size}
        selectionMode={selectionMode}
        onSelectionModeToggle={handleSelectionModeToggle}
        onClearSelection={handleClearSelection}
        onBulkStatusUpdate={handleOpenBulkStatusDialog}
        hasValidBulkStatuses={validBulkStatuses.length > 0}
        onExport={handleExport}
      />

      {/* Bulk Status Update Dialog */}
      <AlertDialog
        open={bulkStatusDialogOpen}
        onOpenChange={setBulkStatusDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Update {selectedIds.size} Order{selectedIds.size > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select a new status for the selected orders. Only valid
              transitions are shown.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="bulk-status">New Status</Label>
            <Select
              value={bulkNewStatus}
              onValueChange={(v) => setBulkNewStatus(v as OrderStatus)}
            >
              <SelectTrigger id="bulk-status" className="mt-1.5">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {validBulkStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validBulkStatuses.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                The selected orders have no common valid status transitions.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStatusUpdate}
              disabled={isUpdating || !bulkNewStatus}
            >
              {isUpdating ? "Updating..." : "Update Status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
