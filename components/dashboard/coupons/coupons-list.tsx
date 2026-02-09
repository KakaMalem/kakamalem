"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Tag,
  Percent,
  DollarSign,
  Truck,
  Gift,
  MoreHorizontal,
  Power,
  PowerOff,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

import { formatPrice } from "@/lib/utils";
import {
  deleteCouponAction,
  toggleCouponStatusAction,
} from "@/lib/actions/coupons";
import type { CouponWithStats } from "@/lib/db/queries/coupons";

interface CouponsListProps {
  tenantId: string;
  storeSlug: string;
  coupons: CouponWithStats[];
  currency: string;
}

type CouponStatus = "active" | "expired" | "scheduled" | "inactive";

function getCouponStatus(coupon: CouponWithStats): CouponStatus {
  if (!coupon.isActive) return "inactive";

  const now = new Date();
  const startsAt = new Date(coupon.startsAt);
  const expiresAt = coupon.expiresAt ? new Date(coupon.expiresAt) : null;

  if (startsAt > now) return "scheduled";
  if (expiresAt && expiresAt < now) return "expired";
  return "active";
}

function getStatusBadge(status: CouponStatus) {
  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          Active
        </Badge>
      );
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "scheduled":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          Scheduled
        </Badge>
      );
    case "inactive":
      return <Badge variant="outline">Inactive</Badge>;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "percentage":
      return <Percent className="size-4" />;
    case "fixed_amount":
      return <DollarSign className="size-4" />;
    case "free_shipping":
      return <Truck className="size-4" />;
    case "buy_x_get_y":
      return <Gift className="size-4" />;
    default:
      return <Tag className="size-4" />;
  }
}

function formatDiscountValue(
  type: string,
  value: string,
  currency: string
): string {
  const numValue = parseFloat(value);
  switch (type) {
    case "percentage":
      return `${numValue}% off`;
    case "fixed_amount":
      return `${formatPrice(numValue, currency)} off`;
    case "free_shipping":
      return "Free shipping";
    case "buy_x_get_y":
      return "BOGO deal";
    default:
      return value;
  }
}

interface CouponItemProps {
  coupon: CouponWithStats;
  storeSlug: string;
  currency: string;
  isPending: boolean;
  onDelete: (coupon: CouponWithStats) => void;
  onToggleStatus: (coupon: CouponWithStats) => void;
}

function CouponItem({
  coupon,
  storeSlug,
  currency,
  isPending,
  onDelete,
  onToggleStatus,
}: CouponItemProps) {
  const [copied, setCopied] = useState(false);
  const status = getCouponStatus(coupon);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const usagePercentage = coupon.usageLimit
    ? Math.min((coupon.usageCount / coupon.usageLimit) * 100, 100)
    : null;

  return (
    <Card className={status === "inactive" ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-4 p-4">
        {/* Type Icon */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {getTypeIcon(coupon.type)}
        </div>

        {/* Coupon Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/${storeSlug}/coupons/${coupon.id}`}
              className="font-mono text-sm font-bold hover:underline"
            >
              {coupon.code}
            </Link>
            <button
              onClick={handleCopyCode}
              className="text-muted-foreground hover:text-foreground"
              title="Copy code"
            >
              {copied ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
            {getStatusBadge(status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{coupon.name}</span>
            <span>•</span>
            <span className="font-medium text-foreground">
              {formatDiscountValue(coupon.type, coupon.value, currency)}
            </span>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="hidden w-32 shrink-0 sm:block">
          <div className="text-sm">
            <span className="font-medium">{coupon.usageCount}</span>
            {coupon.usageLimit && (
              <span className="text-muted-foreground">
                {" "}
                / {coupon.usageLimit}
              </span>
            )}
            <span className="text-muted-foreground"> uses</span>
          </div>
          {usagePercentage !== null && (
            <Progress value={usagePercentage} className="mt-1 h-1.5" />
          )}
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={isPending}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/${storeSlug}/coupons/${coupon.id}`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleStatus(coupon)}>
              {coupon.isActive ? (
                <>
                  <PowerOff className="size-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="size-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(coupon)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export function CouponsList({
  tenantId,
  storeSlug,
  coupons,
  currency,
}: CouponsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<CouponWithStats | null>(
    null
  );

  const handleDelete = (coupon: CouponWithStats) => {
    setCouponToDelete(coupon);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!couponToDelete) return;

    startTransition(async () => {
      const result = await deleteCouponAction(
        tenantId,
        storeSlug,
        couponToDelete.id
      );

      if (result.success) {
        toast.success("Promo code deleted");
        setDeleteDialogOpen(false);
        setCouponToDelete(null);
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to delete promo code");
      }
    });
  };

  const handleToggleStatus = (coupon: CouponWithStats) => {
    startTransition(async () => {
      const result = await toggleCouponStatusAction(
        tenantId,
        storeSlug,
        coupon.id,
        !coupon.isActive
      );

      if (result.success) {
        toast.success(
          coupon.isActive ? "Promo code deactivated" : "Promo code activated"
        );
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to update promo code");
      }
    });
  };

  if (coupons.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Tag className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No promo codes yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first promo code to attract customers.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/dashboard/${storeSlug}/coupons/new`}>
              Create Promo Code
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {coupons.map((coupon) => (
          <CouponItem
            key={coupon.id}
            coupon={coupon}
            storeSlug={storeSlug}
            currency={currency}
            isPending={isPending}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the promo code{" "}
              <span className="font-mono font-bold">
                {couponToDelete?.code}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
