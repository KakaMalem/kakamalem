"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminResolveDispute, addDisputeMessage } from "@/lib/actions/escrow";

export function DisputeResolveActions({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [resolution, setResolution] = useState<"buyer" | "seller" | null>(null);
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Message form
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleResolve = async () => {
    if (!resolution || !note.trim()) {
      toast.error("Please provide a resolution note");
      return;
    }
    setIsResolving(true);
    try {
      const result = await adminResolveDispute(disputeId, resolution, note);
      if (result.success) {
        toast.success(
          resolution === "buyer"
            ? "Dispute resolved — refunded to buyer"
            : "Dispute resolved — released to seller"
        );
        setDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to resolve");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsResolving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    try {
      const result = await addDisputeMessage(disputeId, message);
      if (result.success) {
        toast.success("Message sent");
        setMessage("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to send");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3 pt-2 border-t">
      {/* Admin message */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Send a message to both parties..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleSendMessage}
          disabled={isSending || !message.trim()}
          className="self-end"
        >
          {isSending ? <Loader2 className="size-4 animate-spin" /> : "Send"}
        </Button>
      </div>

      {/* Resolve buttons */}
      <div className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setResolution("buyer")}
            >
              <XCircle className="mr-2 size-4 text-red-500" />
              Refund Buyer
            </Button>
          </DialogTrigger>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setResolution("seller")}
            >
              <CheckCircle2 className="mr-2 size-4 text-green-500" />
              Release to Seller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resolution === "buyer"
                  ? "Refund to Buyer"
                  : "Release to Seller"}
              </DialogTitle>
              <DialogDescription>
                {resolution === "buyer"
                  ? "This will refund the full escrow amount to the buyer. No platform fee will be charged."
                  : "This will release funds to the seller minus the platform fee."}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>Resolution Note (required)</FieldLabel>
              <Textarea
                placeholder="Explain why you made this decision..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={resolution === "buyer" ? "destructive" : "default"}
                onClick={handleResolve}
                disabled={isResolving || !note.trim()}
              >
                {isResolving && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {resolution === "buyer" ? "Confirm Refund" : "Confirm Release"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
