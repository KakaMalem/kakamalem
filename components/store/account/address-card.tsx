"use client";

import { useState } from "react";
import { MoreVertical, Star, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/actions/addresses";
import type { UserAddress } from "@/lib/db/queries/addresses";
import { AddressForm } from "./address-form";
import { toast } from "sonner";

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  PK: "Pakistan",
  IR: "Iran",
  AE: "United Arab Emirates",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  CA: "Canada",
  TR: "Turkey",
  IN: "India",
};

interface AddressCardProps {
  address: UserAddress;
}

export function AddressCard({ address }: AddressCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const countryName = COUNTRY_NAMES[address.countryCode] || address.countryCode;

  async function handleSetDefault() {
    setIsSettingDefault(true);
    try {
      const result = await setDefaultAddressAction(address.id);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Default address updated");
      }
    } catch {
      toast.error("Failed to update default address");
    } finally {
      setIsSettingDefault(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteAddressAction(address.id);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Address deleted");
      }
    } catch {
      toast.error("Failed to delete address");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Label and Default Badge */}
              <div className="flex items-center gap-2 mb-2">
                {address.label && (
                  <span className="font-medium">{address.label}</span>
                )}
                {address.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>

              {/* Name */}
              <p className="font-medium">
                {address.firstName} {address.lastName}
              </p>

              {/* Address Lines */}
              <p className="text-sm text-muted-foreground mt-1">
                {address.street1}
                {address.street2 && `, ${address.street2}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {address.city}, {address.state} {address.postalCode}
              </p>
              <p className="text-sm text-muted-foreground">{countryName}</p>

              {/* Phone */}
              {address.phone && (
                <p className="text-sm text-muted-foreground mt-1">
                  {address.phone}
                </p>
              )}
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Address options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!address.isDefault && (
                  <DropdownMenuItem
                    onClick={handleSetDefault}
                    disabled={isSettingDefault}
                  >
                    <Star className="mr-2 size-4" />
                    Set as default
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
          </DialogHeader>
          <AddressForm
            address={address}
            onSuccess={() => setShowEditDialog(false)}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete address?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this address. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
