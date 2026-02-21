"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Globe,
  FileText,
  Home,
  Trash2,
  Pencil,
  GripVertical,
  ExternalLink,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  FileX,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import {
  createPage,
  deletePage,
  setHomepage,
  reorderPages,
  updatePageMeta,
} from "@/lib/actions/page-builder";
import type { PageType } from "@/lib/validations/page-builder";

type PageSummary = {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  isHomepage: boolean;
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  hasPublished: boolean;
  hasDraft: boolean;
};

interface PagesManagerClientProps {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  initialPages: PageSummary[];
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  homepage: "Homepage",
  about: "About",
  contact: "Contact",
  faq: "FAQ",
  custom: "Custom",
};

const PAGE_TYPE_OPTIONS: { value: PageType; label: string }[] = [
  { value: "about", label: "About Us" },
  { value: "contact", label: "Contact" },
  { value: "faq", label: "FAQ" },
  { value: "custom", label: "Custom Page" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export function PagesManagerClient({
  tenantId,
  storeSlug,
  storeName,
  initialPages,
}: PagesManagerClientProps) {
  const router = useRouter();
  const [pages, setPages] = useState<PageSummary[]>(initialPages);
  const [isPending, startTransition] = useTransition();

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createType, setCreateType] = useState<PageType>("custom");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename dialog
  const [renamePage, setRenamePage] = useState<PageSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameSlug, setRenameSlug] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  // Drag-to-reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleTitleChange = useCallback((title: string) => {
    setCreateTitle(title);
    setCreateSlug(slugify(title));
    setCreateError(null);
  }, []);

  const handleCreatePage = async () => {
    if (!createTitle.trim()) {
      setCreateError("Title is required");
      return;
    }
    if (!createSlug.trim()) {
      setCreateError("Slug is required");
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    const result = await createPage(tenantId, {
      title: createTitle,
      slug: createSlug,
      pageType: createType,
    });
    setIsCreating(false);
    if (!result.success) {
      setCreateError(result.error || "Failed to create page");
      return;
    }
    setShowCreateDialog(false);
    setCreateTitle("");
    setCreateSlug("");
    setCreateType("custom");
    router.push(`/dashboard/${storeSlug}/customize/${result.data!.id}`);
  };

  const handleDeletePage = async () => {
    if (!deletePageId) return;
    setIsDeleting(true);
    const result = await deletePage(tenantId, deletePageId);
    setIsDeleting(false);
    if (result.success) {
      setPages((prev) => prev.filter((p) => p.id !== deletePageId));
    }
    setDeletePageId(null);
  };

  const handleSetHomepage = (pageId: string) => {
    startTransition(async () => {
      const result = await setHomepage(tenantId, pageId);
      if (result.success) {
        setPages((prev) =>
          prev.map((p) => ({ ...p, isHomepage: p.id === pageId }))
        );
      }
    });
  };

  const handleRename = async () => {
    if (!renamePage) return;
    if (!renameTitle.trim()) {
      setRenameError("Title is required");
      return;
    }
    setIsRenaming(true);
    setRenameError(null);
    const result = await updatePageMeta(tenantId, renamePage.id, {
      title: renameTitle,
      slug: renameSlug || undefined,
    });
    setIsRenaming(false);
    if (!result.success) {
      setRenameError(result.error || "Failed to update page");
      return;
    }
    setPages((prev) =>
      prev.map((p) =>
        p.id === renamePage.id
          ? { ...p, title: renameTitle, slug: renameSlug || p.slug }
          : p
      )
    );
    setRenamePage(null);
  };

  // Drag to reorder
  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const reordered = [...pages];
    const fromIdx = reordered.findIndex((p) => p.id === draggingId);
    const toIdx = reordered.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const withOrder = reordered.map((p, i) => ({ ...p, displayOrder: i }));
    setPages(withOrder);
    setDraggingId(null);
    setDragOverId(null);

    startTransition(async () => {
      await reorderPages(
        tenantId,
        withOrder.map((p) => ({ id: p.id, displayOrder: p.displayOrder }))
      );
    });
  };
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const storeUrl = `/store/${storeSlug}`;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/dashboard/${storeSlug}`}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-sm font-semibold">Pages</h1>
              <p className="text-xs text-muted-foreground">{storeName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-3.5" />
                View Store
              </a>
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-1.5 size-3.5" />
              New Page
            </Button>
          </div>
        </div>
      </div>

      {/* Page list */}
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FileText className="mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">No pages yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first page to start customising your storefront.
            </p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 size-4" />
              Create first page
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                storeSlug={storeSlug}
                isDragging={draggingId === page.id}
                isDragOver={dragOverId === page.id}
                isPending={isPending}
                onDragStart={() => handleDragStart(page.id)}
                onDragOver={(e) => handleDragOver(e, page.id)}
                onDrop={(e) => handleDrop(e, page.id)}
                onDragEnd={handleDragEnd}
                onDelete={() => setDeletePageId(page.id)}
                onSetHomepage={() => handleSetHomepage(page.id)}
                onRename={() => {
                  setRenamePage(page);
                  setRenameTitle(page.title);
                  setRenameSlug(page.slug);
                  setRenameError(null);
                }}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Drag rows to reorder pages for navigation.
        </p>
      </div>

      {/* Create page dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
            <DialogDescription>
              Create a new page for your storefront.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-title">Page Title</Label>
              <Input
                id="create-title"
                placeholder="About Us"
                value={createTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-slug">URL Slug</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  /store/{storeSlug}/page/
                </span>
                <Input
                  id="create-slug"
                  placeholder="about-us"
                  value={createSlug}
                  onChange={(e) => {
                    setCreateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    setCreateError(null);
                  }}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Page Type</Label>
              <Select
                value={createType}
                onValueChange={(v) => setCreateType(v as PageType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={isCreating}>
              {isCreating ? "Creating…" : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renamePage} onOpenChange={(o) => !o && setRenamePage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={renameTitle}
                onChange={(e) => {
                  setRenameTitle(e.target.value);
                  setRenameError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  /store/{storeSlug}/page/
                </span>
                <Input
                  value={renameSlug}
                  onChange={(e) => {
                    setRenameSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    setRenameError(null);
                  }}
                  className="font-mono text-sm"
                  disabled={renamePage?.isHomepage}
                />
              </div>
              {renamePage?.isHomepage && (
                <p className="text-xs text-muted-foreground">
                  Homepage slug cannot be changed.
                </p>
              )}
            </div>
            {renameError && (
              <p className="text-sm text-destructive">{renameError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamePage(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming}>
              {isRenaming ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletePageId} onOpenChange={(o) => !o && setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the page and all its content. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PageRowProps {
  page: PageSummary;
  storeSlug: string;
  isDragging: boolean;
  isDragOver: boolean;
  isPending: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onSetHomepage: () => void;
  onRename: () => void;
}

function PageRow({
  page,
  storeSlug,
  isDragging,
  isDragOver,
  isPending,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDelete,
  onSetHomepage,
  onRename,
}: PageRowProps) {
  const editUrl = `/dashboard/${storeSlug}/customize/${page.id}`;
  const previewUrl = page.isHomepage
    ? `/store/${storeSlug}`
    : `/store/${storeSlug}/page/${page.slug}`;

  const statusBadge = page.hasPublished ? (
    <Badge variant="secondary" className="gap-1 text-xs font-normal">
      <CheckCircle2 className="size-3 text-green-500" />
      Published
    </Badge>
  ) : page.hasDraft ? (
    <Badge variant="secondary" className="gap-1 text-xs font-normal">
      <Clock className="size-3 text-amber-500" />
      Draft
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 text-xs font-normal text-muted-foreground">
      <FileX className="size-3" />
      Empty
    </Badge>
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-all",
        isDragging && "opacity-40",
        isDragOver && "border-primary ring-1 ring-primary",
        !isDragging && !isDragOver && "hover:border-accent-foreground/20 hover:bg-accent/30"
      )}
    >
      {/* Drag handle */}
      <button className="cursor-grab touch-none text-muted-foreground/40 group-hover:text-muted-foreground/70 active:cursor-grabbing">
        <GripVertical className="size-4" />
      </button>

      {/* Page icon */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        {page.isHomepage ? (
          <Home className="size-4 text-primary" />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
      </div>

      {/* Page info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{page.title}</span>
          {page.isHomepage && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Homepage
            </Badge>
          )}
          {statusBadge}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground font-mono">
          {page.isHomepage ? `/store/${storeSlug}` : `/store/${storeSlug}/page/${page.slug}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="sm" asChild className="h-7 px-2">
          <Link href={editUrl}>
            <Pencil className="mr-1 size-3" />
            Edit
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3" />
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="mr-2 size-3.5" />
              Rename
            </DropdownMenuItem>
            {!page.isHomepage && (
              <DropdownMenuItem onClick={onSetHomepage} disabled={isPending}>
                <Globe className="mr-2 size-3.5" />
                Set as Homepage
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={page.isHomepage}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
