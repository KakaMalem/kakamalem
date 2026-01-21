"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  updateUserPlatformRole,
  softDeleteUser,
  restoreUser,
  addUserAdminNote,
} from "@/lib/actions/admin-users";
import {
  Shield,
  Trash2,
  RotateCcw,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// =============================================================================
// USER ACTIONS CLIENT COMPONENT
// =============================================================================
// Client component for user management actions
// =============================================================================

interface UserActionsClientProps {
  userId: string;
  userName: string;
  currentRole: string;
  isDeleted: boolean;
  isCurrentUser: boolean;
}

export function UserActionsClient({
  userId,
  userName,
  currentRole,
  isDeleted,
  isCurrentUser,
}: UserActionsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  const handleRoleChange = (
    role: "user" | "platform_admin" | "super_admin"
  ) => {
    if (role === currentRole) return;

    startTransition(async () => {
      const result = await updateUserPlatformRole(userId, role);
      if (result.success) {
        toast.success(result.message || "Role updated");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await softDeleteUser(userId, deleteReason || undefined);
      if (result.success) {
        toast.success(result.message || "User deleted");
        setDeleteReason("");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreUser(userId);
      if (result.success) {
        toast.success(result.message || "User restored");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleAddNote = () => {
    if (!note.trim()) return;

    startTransition(async () => {
      const result = await addUserAdminNote(userId, note.trim());
      if (result.success) {
        toast.success(result.message || "Note added");
        setNote("");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Role Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Platform Role
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={currentRole}
            onValueChange={(value) =>
              handleRoleChange(
                value as "user" | "platform_admin" | "super_admin"
              )
            }
            disabled={isPending || isCurrentUser || isDeleted}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="platform_admin">Platform Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>

          {isCurrentUser && (
            <p className="text-xs text-muted-foreground">
              You cannot change your own role.
            </p>
          )}

          {isDeleted && (
            <p className="text-xs text-muted-foreground">
              Restore the user to change their role.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete/Restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isDeleted ? (
              <RotateCcw className="size-5" />
            ) : (
              <Trash2 className="size-5" />
            )}
            {isDeleted ? "Restore User" : "Delete User"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDeleted ? (
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
                    <RotateCcw className="mr-2 size-4" />
                  )}
                  Restore User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore {userName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore the user&apos;s account. They will be able
                    to log in again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore}>
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <>
              {isCurrentUser ? (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                  <AlertTriangle className="size-4" />
                  <span>You cannot delete your own account.</span>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 size-4" />
                      )}
                      Delete User
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {userName}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will soft-delete the user&apos;s account. They will
                        not be able to log in, but their data will be preserved
                        for compliance purposes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="delete-reason">Reason (optional)</Label>
                      <Textarea
                        id="delete-reason"
                        placeholder="Enter reason for deletion..."
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Add Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Add an internal note about this user..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
          <Button
            variant="outline"
            onClick={handleAddNote}
            disabled={isPending || !note.trim()}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Add Note
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
