"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Crown,
  ShoppingBag,
  Tag,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Card, CardContent } from "@/components/ui/card";

import type { CustomerGroup } from "@/lib/db/schema";
import { deleteCustomerGroupAction } from "@/lib/actions/customer-groups";

interface CustomerGroupsTableProps {
  groups: CustomerGroup[];
  onEdit: (group: CustomerGroup) => void;
  onRefresh: () => void;
}

const TYPE_CONFIG = {
  retail: {
    icon: ShoppingBag,
    label: "Retail",
    variant: "secondary" as const,
  },
  wholesale: {
    icon: Tag,
    label: "Wholesale",
    variant: "outline" as const,
  },
  vip: {
    icon: Crown,
    label: "VIP",
    variant: "default" as const,
  },
};

export function CustomerGroupsTable({
  groups,
  onEdit,
  onRefresh,
}: CustomerGroupsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteGroupId) return;

    setDeletingId(deleteGroupId);
    startTransition(async () => {
      const result = await deleteCustomerGroupAction(deleteGroupId);

      if (!result.success) {
        toast.error(result.error?.message || "Failed to delete group");
      } else {
        toast.success("Customer group deleted");
        onRefresh();
      }

      setDeleteGroupId(null);
      setDeletingId(null);
    });
  };

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="size-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No customer groups</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first customer group to offer targeted pricing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Default</TableHead>
              <TableHead className="w-17.5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const typeConfig =
                TYPE_CONFIG[group.type as keyof typeof TYPE_CONFIG] ||
                TYPE_CONFIG.retail;
              const TypeIcon = typeConfig.icon;
              const isDeleting = deletingId === group.id;

              return (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>
                    <Badge variant={typeConfig.variant} className="gap-1">
                      <TypeIcon className="size-3" />
                      {typeConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-50 truncate">
                    {group.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {group.isDefault && (
                      <Badge variant="outline" className="bg-primary/10">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="size-4" />
                          )}
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(group)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteGroupId(group.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteGroupId}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this customer group. Customers in
              this group will need to be reassigned. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
