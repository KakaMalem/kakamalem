"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerGroupForm } from "@/components/dashboard/customers/customer-group-form";
import { CustomerGroupsTable } from "@/components/dashboard/customers/customer-groups-table";
import type { CustomerGroup } from "@/lib/db/schema";

interface CustomerGroupsClientProps {
  tenantId: string;
  groups: CustomerGroup[];
}

export function CustomerGroupsClient({
  tenantId,
  groups,
}: CustomerGroupsClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEdit = useCallback((group: CustomerGroup) => {
    setEditingGroup(group);
    setFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingGroup(null);
    setFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? "s" : ""}
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          Create Group
        </Button>
      </div>

      <CustomerGroupsTable
        groups={groups}
        onEdit={handleEdit}
        onRefresh={handleRefresh}
      />

      <CustomerGroupForm
        tenantId={tenantId}
        group={editingGroup}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
