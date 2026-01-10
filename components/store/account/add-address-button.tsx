"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddressForm } from "./address-form";

interface AddAddressButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  showIcon?: boolean;
  /** Pass user name to auto-fill from auth instead of showing name fields */
  userName?: string | null;
}

export function AddAddressButton({
  variant = "outline",
  showIcon = false,
  userName,
}: AddAddressButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {showIcon && <Plus className="mr-2 size-4" />}
          Add Address
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Address</DialogTitle>
        </DialogHeader>
        <AddressForm
          userName={userName}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
