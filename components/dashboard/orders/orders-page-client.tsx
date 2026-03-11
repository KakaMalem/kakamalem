"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
import { playNotificationSound } from "@/lib/hooks/use-notification-sound";

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
  showRecordSale?: boolean;
}

async function fetchDashboardOrders(
  tenantId: string,
  searchParams: Record<string, string | undefined>
): Promise<{
  orders: DashboardOrder[];
  pagination: { page: number; totalPages: number; total: number };
  orderCounts: OrderCounts;
}> {
  const params = new URLSearchParams();
  params.set("tenantId", tenantId);
  if (searchParams.page) params.set("page", searchParams.page);
  if (searchParams.limit) params.set("limit", searchParams.limit);
  if (searchParams.search) params.set("search", searchParams.search);
  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.channel) params.set("channel", searchParams.channel);
  if (searchParams.dateFrom) params.set("dateFrom", searchParams.dateFrom);
  if (searchParams.dateTo) params.set("dateTo", searchParams.dateTo);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.order) params.set("order", searchParams.order);

  const res = await fetch(`/api/dashboard/orders?${params}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export function OrdersPageClient({
  storeSlug,
  tenantId,
  currency,
  orders: initialOrders,
  pagination: initialPagination,
  searchParams,
  currentLimit,
  orderCounts: initialOrderCounts,
  showRecordSale = false,
}: OrdersPageClientProps) {
  const queryClient = useQueryClient();

  // Stable key for React Query based on current filters
  const searchParamsKey = useMemo(
    () => JSON.stringify(searchParams),
    [searchParams]
  );

  // Poll orders every 15 seconds
  const { data } = useQuery({
    queryKey: ["dashboard-orders", tenantId, searchParamsKey],
    queryFn: () => fetchDashboardOrders(tenantId, searchParams),
    initialData: {
      orders: initialOrders,
      pagination: initialPagination,
      orderCounts: initialOrderCounts,
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const orders = data.orders;
  const pagination = data.pagination;
  const orderCounts = data.orderCounts;

  // Play sound when new orders arrive
  const prevTotalRef = useRef<number>(initialPagination.total);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      prevTotalRef.current = pagination.total;
      isInitialLoad.current = false;
      return;
    }

    if (pagination.total > prevTotalRef.current) {
      playNotificationSound("order");
    }
    prevTotalRef.current = pagination.total;
  }, [pagination.total]);

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
      queryClient.invalidateQueries({
        queryKey: ["dashboard-orders", tenantId],
      });
    } else {
      toast.error(result.error?.message || "Failed to update orders");
    }

    setIsUpdating(false);
  }, [selectedIds, bulkNewStatus, tenantId, queryClient]);

  // Export orders to Excel
  const handleExport = useCallback(() => {
    const ordersToExport =
      selectedIds.size > 0
        ? orders.filter((o) => selectedIds.has(o.id))
        : orders;

    if (ordersToExport.length === 0) {
      toast.error("No orders to export");
      return;
    }

    // Format date for Excel (local time)
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    // Format phone with LTR mark for RTL support
    const formatPhone = (phone: string | undefined) => {
      if (!phone) return "";
      return `\u200E${phone}`;
    };

    const channelLabels: Record<string, string> = {
      online: "Online",
      pos: "POS / In-Store",
      phone: "Phone",
      social: "Social",
    };

    const paymentStatusLabels: Record<string, string> = {
      unpaid: "Unpaid",
      partial: "Partial",
      paid: "Paid",
      refunded: "Refunded",
      partial_refund: "Partial Refund",
    };

    // Build data rows
    const data = ordersToExport.map((order) => ({
      "Order Number": order.orderNumber,
      Date: formatDate(order.createdAt),
      Time: formatTime(order.createdAt),
      Status: STATUS_LABELS[order.status] || order.status,
      Channel: channelLabels[order.channel] || order.channel,
      "Payment Status":
        paymentStatusLabels[order.paymentStatus] || order.paymentStatus,
      "Customer Name": order.customerSnapshot.name || "",
      "Customer Email": order.customerSnapshot.email || "",
      "Customer Phone": formatPhone(order.customerSnapshot.phone),
      "Item Count": order.itemCount,
      Subtotal: parseFloat(order.subtotal) || 0,
      "Shipping Cost": parseFloat(order.shippingTotal) || 0,
      Tax: parseFloat(order.taxTotal) || 0,
      Discount: parseFloat(order.discountTotal) || 0,
      Total: parseFloat(order.total) || 0,
      Currency: currency,
      "Delivery City": order.shippingAddress?.city || "",
      "Delivery Recipient": order.shippingAddress
        ? `${order.shippingAddress.firstName || ""} ${order.shippingAddress.lastName || ""}`.trim()
        : "",
      "Delivery Phone": formatPhone(order.shippingAddress?.phone),
      "Plus Code": order.shippingAddress?.plusCode || "",
      "Delivery Notes": (order.shippingAddress?.notes || "")
        .replace(/[\r\n]+/g, " ")
        .trim(),
      "Customer Notes": (order.customerNotes || "")
        .replace(/[\r\n]+/g, " ")
        .trim(),
    }));

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 16 }, // Order Number
      { wch: 12 }, // Date
      { wch: 6 }, // Time
      { wch: 12 }, // Status
      { wch: 12 }, // Sales Channel
      { wch: 20 }, // Customer Name
      { wch: 25 }, // Customer Email
      { wch: 16 }, // Customer Phone
      { wch: 10 }, // Item Count
      { wch: 12 }, // Subtotal
      { wch: 12 }, // Shipping Cost
      { wch: 10 }, // Tax
      { wch: 10 }, // Discount
      { wch: 12 }, // Total
      { wch: 8 }, // Currency
      { wch: 14 }, // Delivery City
      { wch: 18 }, // Delivery Recipient
      { wch: 16 }, // Delivery Phone
      { wch: 14 }, // Plus Code
      { wch: 30 }, // Delivery Notes
      { wch: 30 }, // Customer Notes
    ];

    // Create workbook and export
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders-${new Date().toISOString().split("T")[0]}.xlsx`);

    toast.success(`Exported ${ordersToExport.length} orders`);
  }, [orders, selectedIds, currency]);

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
        showRecordSale={showRecordSale}
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
