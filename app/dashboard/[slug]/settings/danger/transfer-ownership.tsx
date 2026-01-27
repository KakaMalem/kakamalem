"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Loader2, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  initiateStoreTransfer,
  cancelStoreTransfer,
} from "@/lib/actions/store-transfers";

interface PendingTransfer {
  id: string;
  toUser: {
    email: string;
    name: string | null;
  };
  expiresAt: string;
  createdAt: string;
  message: string | null;
}

interface TransferOwnershipProps {
  storeId: string;
  storeName: string;
  pendingTransfer: PendingTransfer | null;
}

export function TransferOwnership({
  storeId,
  storeName,
  pendingTransfer,
}: TransferOwnershipProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Form state
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [confirmStoreName, setConfirmStoreName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setNewOwnerEmail("");
    setMessage("");
    setConfirmStoreName("");
    setErrors({});
  };

  const handleInitiateTransfer = () => {
    setErrors({});

    // Client-side validation
    if (!newOwnerEmail.trim()) {
      setErrors({ newOwnerEmail: "Email is required" });
      return;
    }

    if (confirmStoreName.toLowerCase() !== storeName.toLowerCase()) {
      setErrors({ confirmStoreName: "Store name doesn't match" });
      return;
    }

    startTransition(async () => {
      const result = await initiateStoreTransfer(storeId, {
        newOwnerEmail: newOwnerEmail.trim(),
        message: message.trim() || undefined,
        confirmStoreName,
      });

      if (result.error) {
        if (result.error.field) {
          setErrors({ [result.error.field]: result.error.message });
        } else {
          toast.error(result.error.message);
        }
      } else {
        toast.success("Transfer request sent successfully");
        setDialogOpen(false);
        resetForm();
        router.refresh();
      }
    });
  };

  const handleCancelTransfer = () => {
    if (!pendingTransfer) return;

    startTransition(async () => {
      const result = await cancelStoreTransfer(storeId, pendingTransfer.id);

      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Transfer request cancelled");
        setCancelDialogOpen(false);
        router.refresh();
      }
    });
  };

  // If there's a pending transfer, show that state
  if (pendingTransfer) {
    const expiresIn = formatDistanceToNow(new Date(pendingTransfer.expiresAt), {
      addSuffix: true,
    });

    return (
      <Card className="border-amber-500/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-amber-700">
              Pending Transfer Request
            </CardTitle>
          </div>
          <CardDescription>
            You have initiated a transfer request for this store.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Transfer to:</span>{" "}
              <span className="font-medium">
                {pendingTransfer.toUser.name || pendingTransfer.toUser.email}
              </span>
              {pendingTransfer.toUser.name && (
                <span className="text-muted-foreground ml-1">
                  ({pendingTransfer.toUser.email})
                </span>
              )}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Expires:</span>{" "}
              <span className="font-medium">{expiresIn}</span>
            </p>
            {pendingTransfer.message && (
              <p className="text-sm">
                <span className="text-muted-foreground">Message:</span>{" "}
                <span className="italic">
                  &quot;{pendingTransfer.message}&quot;
                </span>
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            The new owner must accept this request before the transfer can be
            completed. They will receive a notification with your request.
          </p>

          <AlertDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-amber-500/50 text-amber-700 hover:bg-amber-50"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Cancel Transfer Request
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Transfer Request?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will cancel the pending transfer request. The recipient
                  will be notified that the transfer has been cancelled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Request</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleCancelTransfer}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Cancel Transfer
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // No pending transfer - show the initiate transfer form
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle>Transfer Ownership</CardTitle>
        </div>
        <CardDescription>
          Transfer this store to another user. They will become the new owner,
          and you will become an admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isPending}>
              Transfer Ownership
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Transfer Store Ownership</AlertDialogTitle>
              <AlertDialogDescription>
                Transfer ownership of &quot;{storeName}&quot; to another user.
                This action requires the new owner to accept the transfer.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newOwnerEmail">New Owner Email</Label>
                <Input
                  id="newOwnerEmail"
                  type="email"
                  placeholder="Enter email address"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  className={errors.newOwnerEmail ? "border-destructive" : ""}
                />
                {errors.newOwnerEmail && (
                  <p className="text-sm text-destructive">
                    {errors.newOwnerEmail}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  The user must have an account on the platform.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a message for the new owner..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {message.length}/500 characters
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  What happens after transfer:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>The new owner will receive full control of the store</li>
                  <li>You will become an admin with limited permissions</li>
                  <li>The request expires in 7 days if not accepted</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmStoreName">
                  Type <span className="font-mono font-bold">{storeName}</span>{" "}
                  to confirm:
                </Label>
                <Input
                  id="confirmStoreName"
                  placeholder="Store name"
                  value={confirmStoreName}
                  onChange={(e) => setConfirmStoreName(e.target.value)}
                  className={
                    errors.confirmStoreName ? "border-destructive" : ""
                  }
                />
                {errors.confirmStoreName && (
                  <p className="text-sm text-destructive">
                    {errors.confirmStoreName}
                  </p>
                )}
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  resetForm();
                }}
              >
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleInitiateTransfer}
                disabled={
                  isPending ||
                  !newOwnerEmail.trim() ||
                  confirmStoreName.toLowerCase() !== storeName.toLowerCase()
                }
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send Transfer Request
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
