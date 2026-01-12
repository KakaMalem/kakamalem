"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CustomerGroup } from "@/lib/db/schema";
import {
  createCustomerGroupAction,
  updateCustomerGroupAction,
  type CustomerGroupInput,
} from "@/lib/actions/customer-groups";

interface CustomerGroupFormProps {
  tenantId: string;
  group?: CustomerGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const GROUP_TYPES = [
  {
    value: "retail",
    label: "Retail",
    description: "Standard retail customers",
  },
  {
    value: "wholesale",
    label: "Wholesale",
    description: "Bulk buyers with special pricing",
  },
  {
    value: "vip",
    label: "VIP",
    description: "Premium customers with best prices",
  },
] as const;

export function CustomerGroupForm({
  tenantId,
  group,
  open,
  onOpenChange,
  onSuccess,
}: CustomerGroupFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [type, setType] = useState<CustomerGroupInput["type"]>(
    (group?.type as CustomerGroupInput["type"]) || "retail"
  );
  const [isDefault, setIsDefault] = useState(group?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!group;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    if (!name.trim() || name.trim().length < 2) {
      const errorMsg = "Group name must be at least 2 characters";
      setErrors({ name: errorMsg });
      toast.error(errorMsg);
      return;
    }

    startTransition(async () => {
      const input: CustomerGroupInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        isDefault,
      };

      const result = isEditing
        ? await updateCustomerGroupAction(group.id, input)
        : await createCustomerGroupAction(tenantId, input);

      if (!result.success) {
        if (result.error?.field) {
          setErrors({ [result.error.field]: result.error.message });
          toast.error(result.error.message);
        } else {
          toast.error(result.error?.message || "Something went wrong");
        }
        return;
      }

      toast.success(
        isEditing ? "Customer group updated" : "Customer group created"
      );
      onOpenChange(false);
      onSuccess?.();

      // Reset form if creating
      if (!isEditing) {
        setName("");
        setDescription("");
        setType("retail");
        setIsDefault(false);
      }
    });
  };

  // Reset form when dialog opens with new group
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && group) {
      setName(group.name);
      setDescription(group.description || "");
      setType((group.type as CustomerGroupInput["type"]) || "retail");
      setIsDefault(group.isDefault);
    } else if (newOpen && !group) {
      setName("");
      setDescription("");
      setType("retail");
      setIsDefault(false);
    }
    setErrors({});
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Customer Group" : "Create Customer Group"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the customer group details."
              : "Create a new customer group for targeted pricing."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Group Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wholesale Buyers"
              disabled={isPending}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Group Type</Label>
            <Select
              value={type}
              onValueChange={(value) =>
                setType(value as CustomerGroupInput["type"])
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((groupType) => (
                  <SelectItem key={groupType.value} value={groupType.value}>
                    <div className="flex flex-col">
                      <span>{groupType.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {groupType.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this group..."
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default Group</Label>
              <p className="text-sm text-muted-foreground">
                New customers will be automatically assigned to this group
              </p>
            </div>
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
