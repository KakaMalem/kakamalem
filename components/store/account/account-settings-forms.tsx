"use client";

import { useState, useEffect } from "react";
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
  setPasswordAction,
  deleteAccountAction,
} from "@/lib/actions/account";
import {
  updateNameSchema,
  changePasswordSchema,
  setPasswordSchema,
} from "@/lib/validations/account";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
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
      const errorMsg = validation.error.issues[0].message;
      setError(errorMsg);
      toast.error(errorMsg);
      setIsPending(false);
      return;
    }

    try {
      const result = await updateNameAction({ name });

      if (result.error) {
        setError(result.error.message);
        toast.error(result.error.message);
        setIsPending(false);
        return;
      }

      toast.success("Name updated successfully");
      setIsPending(false);
    } catch {
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
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

// Map field names to DOM element IDs for scroll-to-error
const PASSWORD_FIELD_ID_MAP: Record<string, string> = {
  currentPassword: "currentPassword",
  newPassword: "newPassword",
  confirmPassword: "confirmPassword",
};

interface ChangePasswordFormProps {
  hasPassword: boolean;
}

export function ChangePasswordForm({ hasPassword }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(false);

  // Scroll to first error field when errors change
  useEffect(() => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    const firstErrorField = errorFields[0];
    const elementId = PASSWORD_FIELD_ID_MAP[firstErrorField];

    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => element.focus(), 300);
      }
    }
  }, [errors]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setIsPending(true);

    try {
      if (hasPassword) {
        // User has a password, validate with current password
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
          toast.error(validation.error.issues[0].message);
          setIsPending(false);
          return;
        }

        const result = await changePasswordAction({
          currentPassword,
          newPassword,
          confirmPassword,
        });

        if (result.error) {
          setErrors({ currentPassword: result.error.message });
          toast.error(result.error.message);
          setIsPending(false);
          return;
        }

        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsPending(false);
      } else {
        // OAuth user setting password for the first time
        const validation = setPasswordSchema.safeParse({
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
          toast.error(validation.error.issues[0].message);
          setIsPending(false);
          return;
        }

        const result = await setPasswordAction({
          newPassword,
          confirmPassword,
        });

        if (result.error) {
          setErrors({ newPassword: result.error.message });
          toast.error(result.error.message);
          setIsPending(false);
          return;
        }

        toast.success("Password set successfully");
        setNewPassword("");
        setConfirmPassword("");
        setIsPending(false);
        // Reload page to update hasPassword state
        window.location.reload();
      }
    } catch {
      const errorMsg = "An unexpected error occurred";
      setErrors({ newPassword: errorMsg });
      toast.error(errorMsg);
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hasPassword && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            You signed up using a social login provider. Set a password to also
            be able to sign in with your email.
          </AlertDescription>
        </Alert>
      )}

      {hasPassword && (
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
      )}

      <Field>
        <FieldLabel htmlFor="newPassword">
          {hasPassword ? "New Password" : "Password"}
        </FieldLabel>
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
        <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
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
        {hasPassword ? "Change Password" : "Set Password"}
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
