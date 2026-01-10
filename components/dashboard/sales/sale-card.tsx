"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  Calendar,
  Loader2,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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

import type { ScheduledSale } from "@/lib/db/schema";
import { formatPrice } from "@/lib/utils";
import {
  deleteScheduledSaleAction,
  toggleScheduledSaleActiveAction,
} from "@/lib/actions/scheduled-sales";

interface SaleCardProps {
  sale: ScheduledSale & {
    product?: {
      name: string;
      price: string;
    };
  };
  currency: string;
  onEdit: (sale: ScheduledSale) => void;
  onRefresh: () => void;
}

type SaleStatus = "active" | "upcoming" | "ended";

function getSaleStatus(sale: ScheduledSale): SaleStatus {
  const now = new Date();
  const startsAt = new Date(sale.startsAt);
  const endsAt = new Date(sale.endsAt);

  if (now < startsAt) return "upcoming";
  if (now > endsAt) return "ended";
  return "active";
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimeRemaining(dateString: string): string {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return "0s";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SaleCard({ sale, currency, onEdit, onRefresh }: SaleCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [status, setStatus] = useState<SaleStatus>(getSaleStatus(sale));
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Update status and countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const newStatus = getSaleStatus(sale);
      setStatus(newStatus);

      if (newStatus === "active") {
        setTimeRemaining(getTimeRemaining(sale.endsAt));
      } else if (newStatus === "upcoming") {
        setTimeRemaining(getTimeRemaining(sale.startsAt));
      } else {
        setTimeRemaining("");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [sale]);

  const handleToggleActive = (isActive: boolean) => {
    startTransition(async () => {
      const result = await toggleScheduledSaleActiveAction(sale.id, isActive);
      if (!result.success) {
        toast.error(result.error?.message || "Failed to update sale");
      } else {
        toast.success(isActive ? "Sale enabled" : "Sale paused");
        onRefresh();
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteScheduledSaleAction(sale.id);
      if (!result.success) {
        toast.error(result.error?.message || "Failed to delete sale");
      } else {
        toast.success("Sale deleted");
        onRefresh();
      }
      setShowDeleteDialog(false);
    });
  };

  const discount = sale.product
    ? Math.round(
        ((parseFloat(sale.product.price) - parseFloat(sale.salePrice)) /
          parseFloat(sale.product.price)) *
          100
      )
    : null;

  return (
    <>
      <Card className={status === "ended" ? "opacity-60" : undefined}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Product and Sale Name */}
              <div className="flex items-center gap-2 mb-2">
                <Tag className="size-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">
                  {sale.product?.name || "Unknown Product"}
                </span>
                {sale.name && (
                  <Badge variant="outline" className="shrink-0">
                    {sale.name}
                  </Badge>
                )}
              </div>

              {/* Price and Discount */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-primary">
                  {formatPrice(parseFloat(sale.salePrice), currency)}
                </span>
                {sale.product && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(parseFloat(sale.product.price), currency)}
                  </span>
                )}
                {discount !== null && discount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    -{discount}%
                  </Badge>
                )}
              </div>

              {/* Date Range */}
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5" />
                  <span>{formatDateTime(sale.startsAt)}</span>
                  <span>→</span>
                  <span>{formatDateTime(sale.endsAt)}</span>
                </div>
              </div>
            </div>

            {/* Status and Actions */}
            <div className="flex flex-col items-end gap-2">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {status === "active" && sale.isActive && (
                  <Badge className="bg-green-500 text-white">
                    <Clock className="size-3 mr-1" />
                    {timeRemaining} left
                  </Badge>
                )}
                {status === "upcoming" && (
                  <Badge variant="secondary">
                    <Clock className="size-3 mr-1" />
                    Starts in {timeRemaining}
                  </Badge>
                )}
                {status === "ended" && <Badge variant="outline">Ended</Badge>}
                {!sale.isActive && status !== "ended" && (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-600"
                  >
                    Paused
                  </Badge>
                )}
              </div>

              {/* Toggle and Menu */}
              <div className="flex items-center gap-2">
                {status !== "ended" && (
                  <Switch
                    checked={sale.isActive}
                    onCheckedChange={handleToggleActive}
                    disabled={isPending}
                  />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(sale)}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scheduled sale?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scheduled sale. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
