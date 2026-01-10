"use client";

import { useState } from "react";
import {
  MoreVertical,
  Star,
  Pencil,
  Trash2,
  MapPin,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
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
import { formatPlusCodeForDisplay } from "@/lib/geo";
import { AddressForm } from "./address-form";
import { toast } from "sonner";

interface AddressCardProps {
  address: UserAddress;
  /** Pass user name to auto-fill from auth instead of showing name fields when editing */
  userName?: string | null;
}

export function AddressCard({ address, userName }: AddressCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [copied, setCopied] = useState(false);

  const latitude = parseFloat(address.latitude);
  const longitude = parseFloat(address.longitude);
  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  const handleCopyPlusCode = () => {
    if (address.plusCode) {
      // Copy Plus Code with city name (e.g., "WH5J+6M Nairobi")
      const textToCopy = address.city
        ? `${address.plusCode} ${address.city}`
        : address.plusCode;
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function handleSetDefault() {
    setIsSettingDefault(true);
    try {
      const result = await setDefaultAddressAction(address.id);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Default location updated");
      }
    } catch {
      toast.error("Failed to update default location");
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
        toast.success("Location deleted");
      }
    } catch {
      toast.error("Failed to delete location");
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
              {/* Address number and Default Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">
                  Address {address.label || ""}
                </span>
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

              {/* Location - Plus Code or Coordinates */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="font-mono">
                    {address.plusCode
                      ? formatPlusCodeForDisplay(address.plusCode, address.city)
                      : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
                  </span>
                </div>
                {address.plusCode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5"
                    onClick={handleCopyPlusCode}
                  >
                    {copied ? (
                      <Check className="size-3 text-green-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                )}
              </div>

              {/* View on Map Link */}
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
              >
                View on Google Maps
                <ExternalLink className="size-3" />
              </a>

              {/* Notes */}
              {address.notes && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {address.notes}
                </p>
              )}

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
                  <span className="sr-only">Location options</span>
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
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <AddressForm
            address={address}
            userName={userName}
            onSuccess={() => setShowEditDialog(false)}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this saved location. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
