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
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  deactivateStore,
  reactivateStore,
  deleteStore,
} from "@/lib/supabase/stores";

interface DangerZoneSettingsProps {
  storeId: string;
  storeName: string;
  storeSlug: string;
  isActive: boolean;
}

export function DangerZoneSettings({
  storeId,
  storeName,
  isActive,
}: DangerZoneSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeactivate = () => {
    startTransition(async () => {
      const result = await deactivateStore(storeId);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Store deactivated successfully");
        router.refresh();
      }
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateStore(storeId);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Store reactivated successfully");
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (deleteConfirmation !== storeName) {
      toast.error("Store name doesn't match");
      return;
    }

    startTransition(async () => {
      const result = await deleteStore(storeId, deleteConfirmation);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Store deleted successfully");
        setDeleteDialogOpen(false);
        router.push("/dashboard");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">
              {isActive ? "Deactivate Store" : "Reactivate Store"}
            </CardTitle>
          </div>
          <CardDescription>
            {isActive
              ? "Temporarily hide your store from customers. You can reactivate it later."
              : "Your store is currently inactive. Reactivate it to make it visible to customers."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Deactivate Store
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate Store?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hide your store from customers. Your data will be
                    preserved and you can reactivate at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeactivate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={handleReactivate} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Reactivate Store
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delete Store</CardTitle>
          </div>
          <CardDescription>
            Permanently delete this store and all its data. This action cannot
            be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isPending}>
                Delete Store Permanently
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Store Permanently?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This will permanently delete your store and all associated
                    data including:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>All products and categories</li>
                    <li>All orders and customer data</li>
                    <li>All media files</li>
                    <li>All settings and configurations</li>
                  </ul>
                  <p className="font-medium text-destructive">
                    This action cannot be undone.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="delete-confirmation" className="text-sm">
                  Type <span className="font-mono font-bold">{storeName}</span>{" "}
                  to confirm:
                </Label>
                <Input
                  id="delete-confirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Store name"
                  className="mt-2"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending || deleteConfirmation !== storeName}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Delete Forever
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
