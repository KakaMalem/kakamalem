"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Clock,
  Loader2,
  RotateCcw,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import {
  approveRefund,
  rejectRefund,
  processRefund,
  quickRefund,
} from "@/lib/actions/refunds";
import type { RefundStatus } from "@/lib/db/schema";

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
  status: RefundStatus;
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

interface RefundListProps {
  refunds: Refund[];
  currency: string;
  canManage?: boolean;
  onRefundUpdated?: () => void;
}

const STATUS_CONFIG: Record<
  RefundStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof Clock;
  }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: Check },
  processing: { label: "Processing", variant: "default", icon: Loader2 },
  completed: { label: "Completed", variant: "outline", icon: Check },
  rejected: { label: "Rejected", variant: "destructive", icon: X },
};

const REASON_LABELS: Record<string, string> = {
  customer_request: "Customer Request",
  defective: "Defective Product",
  wrong_item: "Wrong Item",
  not_as_described: "Not as Described",
  late_delivery: "Late Delivery",
  damaged: "Damaged",
  other: "Other",
};

const METHOD_LABELS: Record<string, string> = {
  original_payment: "Original Payment",
  cash: "Cash",
  store_credit: "Store Credit",
  exchange: "Exchange",
};

export function RefundList({
  refunds,
  currency,
  canManage = false,
  onRefundUpdated,
}: RefundListProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = (refund: Refund) => {
    startTransition(async () => {
      const result = await approveRefund(refund.id);
      if (result.success) {
        toast.success("Refund approved");
        onRefundUpdated?.();
      } else {
        toast.error("Failed to approve", { description: result.error });
      }
    });
  };

  const handleProcess = (refund: Refund) => {
    startTransition(async () => {
      const result = await processRefund(refund.id);
      if (result.success) {
        toast.success("Refund processed successfully");
        onRefundUpdated?.();
      } else {
        toast.error("Failed to process", { description: result.error });
      }
    });
  };

  const handleQuickRefund = (refund: Refund) => {
    startTransition(async () => {
      const result = await quickRefund(refund.id);
      if (result.success) {
        toast.success("Refund completed");
        onRefundUpdated?.();
      } else {
        toast.error("Failed to process", { description: result.error });
      }
    });
  };

  const openRejectDialog = (refund: Refund) => {
    setSelectedRefund(refund);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (!selectedRefund || !rejectReason.trim()) return;

    startTransition(async () => {
      const result = await rejectRefund(selectedRefund.id, rejectReason);
      if (result.success) {
        toast.success("Refund rejected");
        setRejectDialogOpen(false);
        onRefundUpdated?.();
      } else {
        toast.error("Failed to reject", { description: result.error });
      }
    });
  };

  if (refunds.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <RotateCcw className="size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No Refunds</h3>
          <p className="text-sm text-muted-foreground">
            No refunds have been requested for this order
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {refunds.map((refund) => {
          const statusConfig = STATUS_CONFIG[refund.status];
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedId === refund.id;

          return (
            <Card key={refund.id}>
              <Collapsible
                open={isExpanded}
                onOpenChange={(open) => setExpandedId(open ? refund.id : null)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <RotateCcw className="size-4" />
                        {refund.refundNumber}
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon
                            className={`size-3 mr-1 ${
                              refund.status === "processing"
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          {statusConfig.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {new Date(refund.requestedAt).toLocaleDateString()} •{" "}
                        {REASON_LABELS[refund.reasonCode] || refund.reasonCode}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(parseFloat(refund.totalAmount), currency)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {METHOD_LABELS[refund.refundMethod] ||
                          refund.refundMethod}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center border-t"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="mr-2 size-4" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 size-4" />
                        Show Details
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Items */}
                    <div>
                      <p className="text-sm font-medium mb-2">Refund Items</p>
                      <div className="space-y-2">
                        {refund.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-3 py-2"
                          >
                            <div>
                              <p className="font-medium">
                                {item.orderItem.productName}
                              </p>
                              {item.orderItem.variantName && (
                                <p className="text-muted-foreground text-xs">
                                  {item.orderItem.variantName}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p>
                                {item.quantity} ×{" "}
                                {formatPrice(
                                  parseFloat(item.unitRefundAmount),
                                  currency
                                )}
                              </p>
                              <p className="font-medium">
                                {formatPrice(
                                  parseFloat(item.totalRefundAmount),
                                  currency
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amount breakdown */}
                    <div className="text-sm space-y-1 border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>
                          {formatPrice(parseFloat(refund.subtotal), currency)}
                        </span>
                      </div>
                      {parseFloat(refund.shippingRefund) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Shipping
                          </span>
                          <span>
                            {formatPrice(
                              parseFloat(refund.shippingRefund),
                              currency
                            )}
                          </span>
                        </div>
                      )}
                      {parseFloat(refund.taxRefund) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <span>
                            {formatPrice(
                              parseFloat(refund.taxRefund),
                              currency
                            )}
                          </span>
                        </div>
                      )}
                      {parseFloat(refund.restockingFee) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Restocking Fee
                          </span>
                          <span>
                            -
                            {formatPrice(
                              parseFloat(refund.restockingFee),
                              currency
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total Refund</span>
                        <span>
                          {formatPrice(
                            parseFloat(refund.totalAmount),
                            currency
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Reason details */}
                    {refund.reasonDetails && (
                      <div className="text-sm">
                        <p className="font-medium">Details</p>
                        <p className="text-muted-foreground">
                          {refund.reasonDetails}
                        </p>
                      </div>
                    )}

                    {/* Rejection reason */}
                    {refund.status === "rejected" && refund.rejectionReason && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm">
                        <div className="flex items-center gap-2 font-medium text-destructive">
                          <AlertCircle className="size-4" />
                          Rejection Reason
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {refund.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="text-sm space-y-1 border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requested</span>
                        <span>
                          {new Date(refund.requestedAt).toLocaleString()}
                          {refund.requestedByUser?.name && (
                            <span className="text-muted-foreground">
                              {" "}
                              by {refund.requestedByUser.name}
                            </span>
                          )}
                        </span>
                      </div>
                      {refund.approvedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Approved
                          </span>
                          <span>
                            {new Date(refund.approvedAt).toLocaleString()}
                            {refund.approvedByUser?.name && (
                              <span className="text-muted-foreground">
                                {" "}
                                by {refund.approvedByUser.name}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {refund.completedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Completed
                          </span>
                          <span>
                            {new Date(refund.completedAt).toLocaleString()}
                            {refund.processedByUser?.name && (
                              <span className="text-muted-foreground">
                                {" "}
                                by {refund.processedByUser.name}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {refund.rejectedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Rejected
                          </span>
                          <span>
                            {new Date(refund.rejectedAt).toLocaleString()}
                            {refund.rejectedByUser?.name && (
                              <span className="text-muted-foreground">
                                {" "}
                                by {refund.rejectedByUser.name}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {canManage &&
                      (refund.status === "pending" ||
                        refund.status === "approved") && (
                        <div className="flex gap-2 pt-2 border-t">
                          {refund.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleQuickRefund(refund)}
                                disabled={isPending}
                              >
                                {isPending ? (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <Check className="mr-2 size-4" />
                                )}
                                Quick Refund
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(refund)}
                                disabled={isPending}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openRejectDialog(refund)}
                                disabled={isPending}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {refund.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => handleProcess(refund)}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : (
                                <Check className="mr-2 size-4" />
                              )}
                              Process Refund
                            </Button>
                          )}
                        </div>
                      )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this refund request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="reject-reason">Reason</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Item not returned, Policy violation..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Reject Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
