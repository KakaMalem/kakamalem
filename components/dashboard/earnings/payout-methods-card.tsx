"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Smartphone,
  Plus,
  MoreHorizontal,
  Star,
  Trash2,
  Loader2,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  deletePayoutMethod,
  setDefaultPayoutMethod,
} from "@/lib/actions/earnings";
import { AddPayoutMethodDialog } from "./add-payout-method-dialog";
import type { SellerPayoutMethod } from "@/lib/db/queries/earnings";

interface PayoutMethodsCardProps {
  tenantId: string;
  payoutMethods: SellerPayoutMethod[];
}

export function PayoutMethodsCard({
  tenantId,
  payoutMethods,
}: PayoutMethodsCardProps) {
  const router = useRouter();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetDefault = async (methodId: string) => {
    setIsLoading(true);
    try {
      const result = await setDefaultPayoutMethod(tenantId, methodId);
      if (result.success) {
        toast.success("Default payout method updated");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update default");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsLoading(true);
    try {
      const result = await deletePayoutMethod(tenantId, deletingId);
      if (result.success) {
        toast.success("Payout method deleted");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete payout method");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setDeletingId(null);
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case "bank_transfer":
        return <Building2 className="size-5" />;
      case "mobile_money":
        return <Smartphone className="size-5" />;
      default:
        return <CreditCard className="size-5" />;
    }
  };

  const getMethodTypeName = (type: string) => {
    switch (type) {
      case "bank_transfer":
        return "Bank Transfer";
      case "mobile_money":
        return "Mobile Money";
      case "cash":
        return "Cash Pickup";
      default:
        return type;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Payout Methods</CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 size-4" />
            Add Method
          </Button>
        </CardHeader>
        <CardContent>
          {payoutMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CreditCard className="size-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No payout methods</p>
              <p className="text-sm text-muted-foreground">
                Add a bank account or mobile money to receive payouts
              </p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 size-4" />
                Add Payout Method
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {payoutMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      {getMethodIcon(method.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {method.label || getMethodTypeName(method.type)}
                        </span>
                        {method.isDefault && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="size-3" />
                            Default
                          </Badge>
                        )}
                        {method.isVerified && (
                          <Badge variant="outline" className="text-green-600">
                            Verified
                          </Badge>
                        )}
                      </div>
                      {method.type === "bank_transfer" && (
                        <p className="text-sm text-muted-foreground">
                          {method.bankName} - ****
                          {method.accountNumber?.slice(-4)}
                          <span className="mx-1">|</span>
                          {method.accountName}
                        </p>
                      )}
                      {method.type === "mobile_money" && (
                        <p className="text-sm text-muted-foreground">
                          {method.mobileProvider} - {method.mobileNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isLoading}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!method.isDefault && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleSetDefault(method.id)}
                          >
                            <Star className="mr-2 size-4" />
                            Set as Default
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingId(method.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Payout Method Dialog */}
      <AddPayoutMethodDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        tenantId={tenantId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payout Method?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. You can add it again later if
              needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
