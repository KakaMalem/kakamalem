"use client";

import { useState, useEffect, useTransition } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getVersionHistory,
  restorePageLayoutVersion,
} from "@/lib/actions/page-builder";
import type { PuckPageData } from "@/lib/page-builder/types";

type Version = {
  id: string;
  version: number;
  publishedByName: string | null;
  label: string | null;
  createdAt: string;
};

interface VersionHistoryPanelProps {
  tenantId: string;
  pageId: string;
  onRestore: (data: PuckPageData) => void;
}

export function VersionHistoryPanel({
  tenantId,
  pageId,
  onRestore,
}: VersionHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setLoading(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getVersionHistory(tenantId, pageId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setVersions(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, pageId]);

  const handleRestore = (versionId: string, versionNum: number) => {
    startTransition(async () => {
      const result = await restorePageLayoutVersion(
        tenantId,
        pageId,
        versionId
      );
      if (result.success && result.data) {
        toast.success(`Version ${versionNum} restored as draft`);
        onRestore(result.data);
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to restore version");
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title="Version history"
        >
          <Clock className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent className="w-95 sm:w-105">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No published versions yet. Publish your layout to create a
              version.
            </div>
          ) : (
            <div className="space-y-2 px-4">
              {versions.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Version {v.version}
                      </span>
                      {i === 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Latest
                        </span>
                      )}
                    </div>
                    {v.label && (
                      <p className="text-xs text-muted-foreground">{v.label}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(v.createdAt)}</span>
                      {v.publishedByName && (
                        <>
                          <span>by</span>
                          <span>{v.publishedByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(v.id, v.version)}
                    disabled={isPending}
                    className="shrink-0"
                  >
                    <RotateCcw className="mr-1 size-3.5" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
