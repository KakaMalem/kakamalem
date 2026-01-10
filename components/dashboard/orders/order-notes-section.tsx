"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateStaffNotes } from "@/lib/actions/orders";

interface OrderNotesSectionProps {
  orderId: string;
  tenantId: string;
  initialNotes: string;
}

export function OrderNotesSection({
  orderId,
  tenantId,
  initialNotes,
}: OrderNotesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = notes !== initialNotes;

  const handleSave = async () => {
    setIsSaving(true);

    const result = await updateStaffNotes(tenantId, orderId, notes);

    if (result.success) {
      toast.success("Notes saved");
      startTransition(() => {
        router.refresh();
      });
    } else {
      toast.error(result.error?.message || "Failed to save notes");
    }

    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Staff Notes</CardTitle>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isPending}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add internal notes about this order..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="resize-none"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Staff notes are only visible to your team, not to customers.
        </p>
      </CardContent>
    </Card>
  );
}
