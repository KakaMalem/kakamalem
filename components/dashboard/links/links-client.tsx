"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Check,
  QrCode,
  BarChart3,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  Link2,
  MousePointerClick,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatPrice } from "@/lib/utils";
import { toggleLinkActiveAction, deleteLinkAction } from "@/lib/actions/links";
import { LinkFormDialog } from "./link-form-dialog";
import { LinkQrDialog } from "./link-qr-dialog";
import { TARGET_LABELS, type LinkRow, type PickerItem } from "./types";
import type { LinkTargetType } from "@/lib/validations/links";

interface LinksClientProps {
  tenantId: string;
  storeSlug: string;
  currency: string;
  appUrl: string;
  initialLinks: LinkRow[];
  products: PickerItem[];
  categories: PickerItem[];
}

export function LinksClient({
  tenantId,
  storeSlug,
  currency,
  appUrl,
  initialLinks,
  products,
  categories,
}: LinksClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [qrFor, setQrFor] = useState<LinkRow | null>(null);
  const [deleting, setDeleting] = useState<LinkRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shortUrl = (code: string) => `${appUrl.replace(/\/$/, "")}/s/${code}`;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (link: LinkRow) => {
    setEditing(link);
    setFormOpen(true);
  };

  const copy = async (link: LinkRow) => {
    try {
      await navigator.clipboard.writeText(shortUrl(link.code));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const toggleActive = (link: LinkRow) => {
    startTransition(async () => {
      const res = await toggleLinkActiveAction(
        tenantId,
        storeSlug,
        link.id,
        !link.isActive
      );
      if (!res.success) {
        toast.error(res.error?.message ?? "Failed");
        return;
      }
      toast.success(link.isActive ? "Link disabled" : "Link enabled");
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const link = deleting;
    startTransition(async () => {
      const res = await deleteLinkAction(tenantId, storeSlug, link.id);
      if (!res.success) {
        toast.error(res.error?.message ?? "Failed");
        return;
      }
      toast.success("Link deleted");
      setDeleting(null);
      router.refresh();
    });
  };

  const describeTarget = (link: LinkRow): string => {
    switch (link.targetType) {
      case "product":
        return link.productName ?? "Product";
      case "category":
        return link.categoryName ?? "Category";
      case "url":
        return link.targetUrl ?? "Custom URL";
      default:
        return TARGET_LABELS.store;
    }
  };

  const isExpired = (link: LinkRow) =>
    link.expiresAt != null && new Date(link.expiresAt) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Create link
        </Button>
      </div>

      {initialLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
            <Link2 className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No links yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a short link to your store or a product, share it on social
            or WhatsApp, and track every click and sale.
          </p>
          <Button onClick={openCreate} className="mt-6">
            <Plus className="mr-2 size-4" />
            Create your first link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {initialLinks.map((link) => {
            const expired = isExpired(link);
            const convRate =
              link.totalClicks > 0
                ? Math.round((link.totalConversions / link.totalClicks) * 100)
                : 0;
            return (
              <div
                key={link.id}
                className="rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {link.name || link.code}
                      </span>
                      {!link.isActive && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                      {expired && <Badge variant="destructive">Expired</Badge>}
                      <Badge variant="outline" className="font-normal">
                        {TARGET_LABELS[link.targetType as LinkTargetType] ??
                          "Link"}
                      </Badge>
                    </div>

                    {/* Short URL + copy */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => copy(link)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm font-medium hover:bg-muted/70"
                        title="Copy link"
                      >
                        {copiedId === link.id ? (
                          <Check className="size-3.5 text-green-600" />
                        ) : (
                          <Copy className="size-3.5 text-muted-foreground" />
                        )}
                        <span className="truncate">
                          {shortUrl(link.code).replace(/^https?:\/\//, "")}
                        </span>
                      </button>
                    </div>

                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      → {describeTarget(link)}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQrFor(link)}
                    >
                      <QrCode className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/${storeSlug}/links/${link.id}`}>
                        <BarChart3 className="mr-1.5 size-4" />
                        Stats
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(link)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(link)}>
                          <Power className="mr-2 size-4" />
                          {link.isActive ? "Disable" : "Enable"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleting(link)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
                  <Stat
                    icon={<MousePointerClick className="size-3.5" />}
                    label="Clicks"
                    value={link.totalClicks.toLocaleString()}
                    sub={`${link.uniqueClicks.toLocaleString()} unique`}
                  />
                  <Stat
                    icon={<ShoppingBag className="size-3.5" />}
                    label="Orders"
                    value={link.totalConversions.toLocaleString()}
                    sub={`${convRate}% conv.`}
                  />
                  <Stat
                    label="Revenue"
                    value={formatPrice(parseFloat(link.totalRevenue), currency)}
                  />
                  <Stat
                    label="Created"
                    value={new Date(link.createdAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit */}
      <LinkFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        storeSlug={storeSlug}
        appUrl={appUrl}
        products={products}
        categories={categories}
        link={editing}
        onSaved={() => router.refresh()}
      />

      {/* QR */}
      {qrFor && (
        <LinkQrDialog
          open={!!qrFor}
          onOpenChange={(o) => !o && setQrFor(null)}
          url={shortUrl(qrFor.code)}
          code={qrFor.code}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this link?</AlertDialogTitle>
            <AlertDialogDescription>
              The short link will stop working and its click history will be
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
