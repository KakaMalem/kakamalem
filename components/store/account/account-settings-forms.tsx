"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
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
  updateNameAction,
  changePasswordAction,
  deleteAccountAction,
  updateNameSchema,
  changePasswordSchema,
} from "@/lib/actions/account";
import { toast } from "sonner";

// =============================================================================
// UPDATE NAME FORM
// =============================================================================

interface UpdateNameFormProps {
  currentName: string;
}

export function UpdateNameForm({ currentName }: UpdateNameFormProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const validation = updateNameSchema.safeParse({ name });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      setIsPending(false);
      return;
    }

    try {
      const result = await updateNameAction({ name });

      if (result.error) {
        setError(result.error.message);
        setIsPending(false);
        return;
      }

      toast.success("Name updated successfully");
      setIsPending(false);
    } catch {
      setError("An unexpected error occurred");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <FieldLabel htmlFor="name">Full Name</FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          aria-invalid={!!error}
        />
        <FieldError>{error}</FieldError>
      </Field>
      <Button type="submit" disabled={isPending || name === currentName}>
        {isPending && <Spinner />}
        Update Name
      </Button>
    </form>
  );
}

// =============================================================================
// CHANGE PASSWORD FORM
// =============================================================================

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setIsPending(true);

    const validation = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      setIsPending(false);
      return;
    }

    try {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (result.error) {
        setErrors({ currentPassword: result.error.message });
        setIsPending(false);
        return;
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPending(false);
    } catch {
      setErrors({ currentPassword: "An unexpected error occurred" });
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <FieldLabel htmlFor="currentPassword">Current Password</FieldLabel>
        <Input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={isPending}
          aria-invalid={!!errors.currentPassword}
        />
        <FieldError>{errors.currentPassword}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="newPassword">New Password</FieldLabel>
        <Input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isPending}
          aria-invalid={!!errors.newPassword}
        />
        {errors.newPassword ? (
          <FieldError>{errors.newPassword}</FieldError>
        ) : (
          <FieldDescription>
            Must contain uppercase, lowercase, and number (min 8 characters)
          </FieldDescription>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="confirmPassword">Confirm New Password</FieldLabel>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isPending}
          aria-invalid={!!errors.confirmPassword}
        />
        <FieldError>{errors.confirmPassword}</FieldError>
      </Field>

      <Button type="submit" disabled={isPending}>
        {isPending && <Spinner />}
        Change Password
      </Button>
    </form>
  );
}

// =============================================================================
// DELETE ACCOUNT SECTION
// =============================================================================

export function DeleteAccountSection() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteAccountAction();

      if (result.error) {
        toast.error(result.error.message);
        setIsPending(false);
        return;
      }

      toast.success("Account deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete account");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-destructive">
          Delete Account
        </h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Delete Account</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Field>
              <FieldLabel htmlFor="confirm-delete">
                Type &quot;DELETE&quot; to confirm
              </FieldLabel>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={isPending}
              />
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending || confirmText !== "DELETE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
