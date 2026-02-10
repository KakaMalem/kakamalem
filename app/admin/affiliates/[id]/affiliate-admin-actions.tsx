"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminReviewAffiliate,
  adminReactivateAffiliate,
  adminDeleteAffiliate,
} from "@/lib/actions/platform-affiliates";

interface AffiliateAdminActionsProps {
  affiliateId: string;
  currentStatus: string;
}

export function AffiliateAdminActions({
  affiliateId,
  currentStatus,
}: AffiliateAdminActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleAction = async (
    action: "approve" | "reject" | "suspend" | "reactivate"
  ) => {
    setIsLoading(true);
    try {
      let result;

      if (action === "reactivate") {
        result = await adminReactivateAffiliate(affiliateId);
      } else {
        result = await adminReviewAffiliate({
          affiliateId,
          action,
          reason: reason || undefined,
        });
      }

      if (result.success) {
        toast.success(
          action === "approve"
            ? "Affiliate approved successfully"
            : action === "reject"
              ? "Affiliate rejected"
              : action === "suspend"
                ? "Affiliate suspended"
                : "Affiliate reactivated"
        );
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to update affiliate");
      }
    } catch (error) {
      console.error("Error updating affiliate:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
      setReason("");
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const result = await adminDeleteAffiliate(affiliateId);
      if (result.success) {
        toast.success("Affiliate deleted permanently");
        router.push("/admin/affiliates");
      } else {
        toast.error(result.error?.message || "Failed to delete affiliate");
      }
    } catch (error) {
      console.error("Error deleting affiliate:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Actions:
          </span>

          {/* Approve - only for pending */}
          {currentStatus === "pending" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={isLoading}>
                  <CheckCircle className="mr-2 size-4" />
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve Affiliate</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will activate the affiliate account and enable their
                    vanity URL.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="approve-notes">Notes (optional)</Label>
                  <Textarea
                    id="approve-notes"
                    placeholder="Add any notes..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setReason("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("approve")}
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Reject - only for pending */}
          {currentStatus === "pending" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isLoading}>
                  <XCircle className="mr-2 size-4" />
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Application</AlertDialogTitle>
                  <AlertDialogDescription>
                    The affiliate will be notified that their application was
                    rejected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Reason (optional)</Label>
                  <Textarea
                    id="reject-reason"
                    placeholder="Reason for rejection..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setReason("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("reject")}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Suspend - only for approved */}
          {currentStatus === "approved" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoading}>
                  <Ban className="mr-2 size-4" />
                  Suspend
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend Affiliate</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will disable the affiliate&apos;s vanity URL and pause
                    their commission earnings. They will not be able to earn new
                    commissions until reactivated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="suspend-reason">Reason</Label>
                  <Textarea
                    id="suspend-reason"
                    placeholder="Reason for suspension..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setReason("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("suspend")}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Suspend
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Reactivate - only for suspended */}
          {currentStatus === "suspended" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={isLoading}>
                  <RefreshCw className="mr-2 size-4" />
                  Reactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reactivate Affiliate</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore the affiliate&apos;s account and re-enable
                    their vanity URL.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("reactivate")}
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Reactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Rejected status - allow re-review */}
          {currentStatus === "rejected" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={isLoading}>
                  <CheckCircle className="mr-2 size-4" />
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve Affiliate</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will approve the previously rejected affiliate and
                    activate their account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="approve-notes-2">Notes (optional)</Label>
                  <Textarea
                    id="approve-notes-2"
                    placeholder="Add any notes..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setReason("")}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction("approve")}
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* No actions available */}
          {!["pending", "approved", "suspended", "rejected"].includes(
            currentStatus
          ) && (
            <span className="text-sm text-muted-foreground">
              No actions available
            </span>
          )}

          {/* Delete - always available */}
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete Affiliate Permanently
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this affiliate account and all
                    related data including clicks, referrals, commissions, and
                    payouts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
