"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefundDialog } from "./refund-dialog";
import { RefundList } from "./refund-list";

interface RefundableItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  quantityRefunded: number;
  price: string;
  subtotal: string;
}

interface RefundItem {
  id: string;
  quantity: number;
  unitRefundAmount: string;
  totalRefundAmount: string;
  orderItem: {
    id: string;
    productName: string;
    variantName?: string | null;
    quantity: number;
    price: string;
  };
}

interface Refund {
  id: string;
  refundNumber: string;
  type: string;
  status: "pending" | "approved" | "processing" | "completed" | "rejected";
  subtotal: string;
  shippingRefund: string;
  taxRefund: string;
  restockingFee: string;
  totalAmount: string;
  currencyCode: string;
  refundMethod: string;
  reasonCode: string;
  reasonDetails?: string | null;
  customerNotes?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  items: RefundItem[];
  requestedByUser?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
  approvedByUser?: { id: string; name: string | null } | null;
  processedByUser?: { id: string; name: string | null } | null;
  rejectedByUser?: { id: string; name: string | null } | null;
}

interface OrderRefundsSectionProps {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  currency: string;
  items: RefundableItem[];
  refunds: Refund[];
  amountPaid: number;
  amountRefunded: number;
  canRefund: boolean;
  canManage?: boolean;
}

export function OrderRefundsSection({
  tenantId,
  orderId,
  orderNumber,
  currency,
  items,
  refunds,
  amountPaid,
  amountRefunded,
  canRefund,
  canManage = false,
}: OrderRefundsSectionProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if any items are refundable
  const hasRefundableItems = items.some(
    (item) => item.quantity > (item.quantityRefunded || 0)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="size-5" />
          Refunds
        </CardTitle>
        {canRefund && hasRefundableItems && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <RotateCcw className="mr-2 size-4" />
            Create Refund
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <RefundList
          refunds={refunds}
          currency={currency}
          canManage={canManage}
          onRefundUpdated={() => router.refresh()}
        />
      </CardContent>

      {/* Refund Dialog */}
      <RefundDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenantId}
        orderId={orderId}
        orderNumber={orderNumber}
        currency={currency}
        items={items}
        amountPaid={amountPaid}
        amountRefunded={amountRefunded}
        onRefundCreated={() => router.refresh()}
      />
    </Card>
  );
}
