"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { requestEmailChangeAction } from "@/lib/actions/account";
import { toast } from "sonner";

interface EmailChangeFormProps {
  currentEmail: string;
}

export function EmailChangeForm({ currentEmail }: EmailChangeFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsPending(true);

    if (!newEmail) {
      setError("Email is required");
      setIsPending(false);
      return;
    }

    if (newEmail === currentEmail) {
      setError("New email must be different from current email");
      setIsPending(false);
      return;
    }

    try {
      const result = await requestEmailChangeAction(newEmail);

      if (result.error) {
        setError(result.error.message);
        setIsPending(false);
        return;
      }

      setSuccess(true);
      setNewEmail("");
      toast.success("Verification email sent");
      setIsPending(false);
    } catch {
      setError("An unexpected error occurred");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Current email:</span>
        <Badge variant="secondary">{currentEmail}</Badge>
      </div>

      {success && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            A verification link has been sent to your new email address. Please
            check your inbox and click the link to confirm the change.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="newEmail">New Email Address</FieldLabel>
          <Input
            id="newEmail"
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder="Enter new email address"
            disabled={isPending}
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Button type="submit" disabled={isPending || !newEmail}>
          {isPending && <Spinner />}
          Request Email Change
        </Button>
      </form>
    </div>
  );
}
