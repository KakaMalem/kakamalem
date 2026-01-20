"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  updateStoreStatus,
  updateStoreSubscription,
  extendStoreTrial,
  addStoreNotes,
} from "@/lib/actions/admin";
import {
  Ban,
  CheckCircle,
  Clock,
  Crown,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// =============================================================================
// STORE ACTIONS CLIENT COMPONENT
// =============================================================================
// Client component for store management actions
// =============================================================================

interface StoreActionsClientProps {
  storeId: string;
  storeName: string;
  currentStatus: string;
  currentPlan: string;
  currentSubscriptionStatus: string;
  currentNotes: string | null;
  settings: {
    proPlanPriceAfn: string;
    trialDurationDays: number;
  };
}

export function StoreActionsClient({
  storeId,
  storeName,
  currentStatus,
  currentPlan,
  currentSubscriptionStatus,
  currentNotes,
  settings,
}: StoreActionsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [extendDays, setExtendDays] = useState(7);
  const [notes, setNotes] = useState(currentNotes || "");
  const [suspendReason, setSuspendReason] = useState("");

  const handleStatusChange = (
    status: "pending_review" | "active" | "suspended" | "inactive",
    reason?: string
  ) => {
    startTransition(async () => {
      const result = await updateStoreStatus(storeId, status, reason);
      if (result.success) {
        toast.success(result.message || "Status updated");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSubscriptionChange = (
    plan: "free" | "pro",
    status: "trialing" | "active" | "past_due" | "cancelled" | "expired"
  ) => {
    startTransition(async () => {
      const result = await updateStoreSubscription(storeId, plan, status);
      if (result.success) {
        toast.success(result.message || "Subscription updated");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleExtendTrial = () => {
    startTransition(async () => {
      const result = await extendStoreTrial(storeId, extendDays);
      if (result.success) {
        toast.success(result.message || "Trial extended");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      const result = await addStoreNotes(storeId, notes);
      if (result.success) {
        toast.success("Notes saved");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentStatus !== "active" && (
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => handleStatusChange("active")}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 size-4" />
              )}
              Activate Store
            </Button>
          )}

          {currentStatus === "active" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  <Ban className="mr-2 size-4" />
                  Suspend Store
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend {storeName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately disable the store. Customers will not
                    be able to access it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="suspend-reason">Reason (optional)</Label>
                  <Textarea
                    id="suspend-reason"
                    placeholder="Enter reason for suspension..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      handleStatusChange("suspended", suspendReason)
                    }
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Suspend
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="size-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentPlan === "free" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Crown className="mr-2 size-4" />
                  )}
                  Upgrade to Pro ({settings.proPlanPriceAfn} AFN/mo)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Upgrade to Pro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will upgrade the store to Pro plan with all features
                    enabled. Make sure payment has been received.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleSubscriptionChange("pro", "active")}
                  >
                    Confirm Upgrade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {currentPlan === "pro" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                >
                  <AlertTriangle className="mr-2 size-4" />
                  Downgrade to Free
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Downgrade to Free?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will downgrade the store to the free plan. They will
                    lose access to Pro features and be limited to{" "}
                    {settings.trialDurationDays} products.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleSubscriptionChange("free", "active")}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Downgrade
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {currentSubscriptionStatus === "trialing" && (
            <div className="space-y-2">
              <Label>Extend Trial</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 7)}
                  className="w-20"
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  days
                </span>
                <Button
                  variant="outline"
                  onClick={handleExtendTrial}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Clock className="mr-2 size-4" />
                  )}
                  Extend
                </Button>
              </div>
            </div>
          )}

          {currentSubscriptionStatus === "expired" && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleSubscriptionChange("free", "trialing")}
              disabled={isPending}
            >
              <Clock className="mr-2 size-4" />
              Restart Trial
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Admin Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Add internal notes about this store..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
          <Button
            variant="outline"
            onClick={handleSaveNotes}
            disabled={isPending || notes === (currentNotes || "")}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Save Notes
          </Button>
        </CardContent>
      </Card>

      {/* Status Change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={currentStatus}
            onValueChange={(value) =>
              handleStatusChange(
                value as "pending_review" | "active" | "suspended" | "inactive"
              )
            }
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
