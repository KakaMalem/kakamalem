"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Printer,
  Copy,
  XCircle,
  Check,
  Loader2,
  Download,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { updateOrderStatus } from "@/lib/actions/orders";
import type { OrderStatus } from "@/lib/db/queries/orders";

interface OrderQuickActionsProps {
  orderId: string;
  tenantId: string;
  storeSlug: string;
  orderNumber: string;
  currentStatus: OrderStatus;
}

export function OrderQuickActions({
  orderId,
  tenantId,
  storeSlug,
  orderNumber,
  currentStatus,
}: OrderQuickActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);

  const canCancel =
    currentStatus === "pending" ||
    currentStatus === "confirmed" ||
    currentStatus === "processing";

  const handleCopyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      toast.success("Order number copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy order number");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvoice = () => {
    window.open(
      `/api/dashboard/${storeSlug}/orders/${orderId}/invoice`,
      "_blank"
    );
  };

  const handleCreateShareLink = async () => {
    setIsCreatingShareLink(true);
    try {
      const response = await fetch(
        `/api/dashboard/${storeSlug}/orders/${orderId}/invoice/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInDays: 7 }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create share link");
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.url);
      toast.success("Invoice link copied to clipboard", {
        description: "Link expires in 7 days",
      });
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await updateOrderStatus(tenantId, orderId, "cancelled");
      if (result.success) {
        toast.success("Order cancelled successfully");
        setShowCancelDialog(false);
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to cancel order");
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownloadInvoice}>
            <Download className="mr-2 size-4" />
            Download Invoice
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleCreateShareLink}
            disabled={isCreatingShareLink}
          >
            {isCreatingShareLink ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 size-4" />
            )}
            Copy Invoice Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePrint}>
            <Printer className="mr-2 size-4" />
            Print Receipt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyOrderNumber}>
            {copied ? (
              <Check className="mr-2 size-4 text-green-600" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            Copy Order Number
          </DropdownMenuItem>
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCancelDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 size-4" />
                Cancel Order
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel order <strong>{orderNumber}</strong>. The
              customer will be notified and any pending payments will need to be
              refunded manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
