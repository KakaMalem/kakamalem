"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Store, Check, X, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { safeFormatDistanceToNow } from "@/lib/utils/safe-date";
import {
  acceptStoreTransfer,
  rejectStoreTransfer,
} from "@/lib/actions/store-transfers";

interface TransferRequest {
  id: string;
  tenant: {
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  fromUser: {
    name: string | null;
    email: string;
    image: string | null;
  };
  message: string | null;
  expiresAt: string;
  createdAt: string;
}

interface TransferRequestsBannerProps {
  requests: TransferRequest[];
}

export function TransferRequestsBanner({
  requests,
}: TransferRequestsBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "accept" | "reject" | null
  >(null);
  const [selectedRequest, setSelectedRequest] =
    useState<TransferRequest | null>(null);

  if (requests.length === 0) return null;

  const handleAccept = (request: TransferRequest) => {
    setSelectedRequest(request);
    setActionRequestId(request.id);
    setConfirmAction("accept");
    setConfirmDialogOpen(true);
  };

  const handleReject = (request: TransferRequest) => {
    setSelectedRequest(request);
    setActionRequestId(request.id);
    setConfirmAction("reject");
    setConfirmDialogOpen(true);
  };

  const confirmActionHandler = () => {
    if (!actionRequestId || !confirmAction || !selectedRequest) return;

    startTransition(async () => {
      const result =
        confirmAction === "accept"
          ? await acceptStoreTransfer(actionRequestId)
          : await rejectStoreTransfer(actionRequestId);

      if (result.error) {
        toast.error(result.error.message);
      } else {
        if (confirmAction === "accept") {
          toast.success(
            `You are now the owner of "${selectedRequest.tenant.name}"!`
          );
          // Redirect to the new store's dashboard
          router.push(`/dashboard/${selectedRequest.tenant.slug}`);
        } else {
          toast.success("Transfer request declined");
          router.refresh();
        }
      }

      setConfirmDialogOpen(false);
      setActionRequestId(null);
      setConfirmAction(null);
      setSelectedRequest(null);
    });
  };

  return (
    <>
      <div className="space-y-3 mb-6">
        {requests.map((request) => {
          const expiresIn = safeFormatDistanceToNow(request.expiresAt, {
            addSuffix: true,
          });
          const isProcessing = isPending && actionRequestId === request.id;

          return (
            <div
              key={request.id}
              className="bg-primary/5 border border-primary/20 rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                {/* Store Logo */}
                {request.tenant.logoUrl ? (
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden border shrink-0">
                    <Image
                      src={request.tenant.logoUrl}
                      alt={request.tenant.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        Store Transfer Request
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {request.fromUser.name || request.fromUser.email}
                        </span>{" "}
                        wants to transfer{" "}
                        <span className="font-medium text-foreground">
                          &quot;{request.tenant.name}&quot;
                        </span>{" "}
                        to you
                      </p>
                    </div>

                    {/* Expiration */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>Expires {expiresIn}</span>
                    </div>
                  </div>

                  {/* Message */}
                  {request.message && (
                    <p className="mt-2 text-sm text-muted-foreground italic bg-muted/50 rounded px-2 py-1">
                      &quot;{request.message}&quot;
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(request)}
                      disabled={isProcessing}
                    >
                      {isProcessing && confirmAction === "accept" ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request)}
                      disabled={isProcessing}
                    >
                      {isProcessing && confirmAction === "reject" ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <X className="mr-1 h-3 w-3" />
                      )}
                      Decline
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">
                      You&apos;ll become the owner. Current owner becomes admin.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "accept"
                ? "Accept Store Ownership?"
                : "Decline Transfer Request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "accept" ? (
                <>
                  You will become the owner of{" "}
                  <strong>&quot;{selectedRequest?.tenant.name}&quot;</strong>{" "}
                  with full control over all settings, products, and orders. The
                  current owner will become an admin.
                </>
              ) : (
                <>
                  The current owner will be notified that you declined the
                  transfer request for{" "}
                  <strong>&quot;{selectedRequest?.tenant.name}&quot;</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              variant={confirmAction === "accept" ? "default" : "destructive"}
              onClick={confirmActionHandler}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {confirmAction === "accept" ? "Accept Ownership" : "Decline"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
