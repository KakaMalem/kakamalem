"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  linkTargetTypes,
  type LinkInput,
  type LinkTargetType,
} from "@/lib/validations/links";
import { createLinkAction, updateLinkAction } from "@/lib/actions/links";
import type { LinkRow, PickerItem } from "./types";
import { TARGET_LABELS } from "./types";

interface LinkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  storeSlug: string;
  appUrl: string;
  products: PickerItem[];
  categories: PickerItem[];
  /** Provided in edit mode */
  link?: LinkRow | null;
  onSaved: () => void;
}

const shortPrefix = (appUrl: string) =>
  `${appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}/s/`;

// Convert a stored ISO string to the value a <input type="date"> expects.
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function LinkFormDialog({
  open,
  onOpenChange,
  tenantId,
  storeSlug,
  appUrl,
  products,
  categories,
  link,
  onSaved,
}: LinkFormDialogProps) {
  const isEdit = !!link;
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [form, setForm] = useState(() => ({
    name: link?.name ?? "",
    targetType: (link?.targetType as LinkTargetType) ?? "store",
    productId: link?.productId ?? "",
    categoryId: link?.categoryId ?? "",
    targetUrl: link?.targetUrl ?? "",
    customCode: link?.code ?? "",
    utmSource: link?.utmSource ?? "",
    utmMedium: link?.utmMedium ?? "",
    utmCampaign: link?.utmCampaign ?? "",
    utmContent: link?.utmContent ?? "",
    utmTerm: link?.utmTerm ?? "",
    expiresAt: toDateInput(link?.expiresAt ?? null),
    isActive: link?.isActive ?? true,
  }));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    startTransition(async () => {
      const payload: LinkInput = {
        name: form.name,
        targetType: form.targetType,
        productId: form.productId || null,
        categoryId: form.categoryId || null,
        targetUrl: form.targetUrl,
        customCode: form.customCode,
        utmSource: form.utmSource,
        utmMedium: form.utmMedium,
        utmCampaign: form.utmCampaign,
        utmContent: form.utmContent,
        utmTerm: form.utmTerm,
        expiresAt: form.expiresAt
          ? new Date(`${form.expiresAt}T23:59:59`).toISOString()
          : "",
        isActive: form.isActive,
      };

      const result = isEdit
        ? await updateLinkAction(tenantId, storeSlug, link!.id, payload)
        : await createLinkAction(tenantId, storeSlug, payload);

      if (!result.success) {
        toast.error(result.error?.message ?? "Something went wrong");
        return;
      }
      toast.success(isEdit ? "Link updated" : "Link created");
      onSaved();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit link" : "Create link"}</DialogTitle>
          <DialogDescription>
            A short, trackable link you can share anywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="link-name">Name (optional)</Label>
            <Input
              id="link-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Instagram bio"
              disabled={isPending}
            />
          </div>

          {/* Target type */}
          <div className="space-y-2">
            <Label>Where it goes</Label>
            <Select
              value={form.targetType}
              onValueChange={(v) => set("targetType", v as LinkTargetType)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {linkTargetTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TARGET_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target detail */}
          {form.targetType === "product" && (
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={form.productId}
                onValueChange={(v) => set("productId", v)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.targetType === "category" && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => set("categoryId", v)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.targetType === "url" && (
            <div className="space-y-2">
              <Label htmlFor="link-url">Destination URL or path</Label>
              <Input
                id="link-url"
                value={form.targetUrl}
                onChange={(e) => set("targetUrl", e.target.value)}
                placeholder="/products  or  https://…"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                A path like <code>/products</code> stays on your store; a full
                https:// URL goes anywhere.
              </p>
            </div>
          )}

          {/* Custom code */}
          <div className="space-y-2">
            <Label htmlFor="link-code">Short code (optional)</Label>
            <div className="flex items-center gap-0 rounded-md border focus-within:ring-1 focus-within:ring-ring">
              <span className="px-3 text-sm text-muted-foreground whitespace-nowrap">
                {shortPrefix(appUrl)}
              </span>
              <Input
                id="link-code"
                value={form.customCode}
                onChange={(e) => set("customCode", e.target.value)}
                placeholder="auto"
                disabled={isPending}
                className="border-0 pl-0 focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to generate a short code automatically.
            </p>
          </div>

          {/* Expiry + active */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="link-expiry">Expires (optional)</Label>
              <Input
                id="link-expiry"
                type="date"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Active</Label>
              <div className="flex h-9 items-center">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => set("isActive", v)}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Advanced / UTM */}
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                showAdvanced && "rotate-180"
              )}
            />
            UTM tags (advanced)
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              {(
                [
                  ["utmSource", "Source", "instagram"],
                  ["utmMedium", "Medium", "social"],
                  ["utmCampaign", "Campaign", "eid_sale"],
                  ["utmContent", "Content", "story_1"],
                  ["utmTerm", "Term", "shoes"],
                ] as const
              ).map(([key, label, ph]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`link-${key}`} className="text-xs">
                    {label}
                  </Label>
                  <Input
                    id={`link-${key}`}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={ph}
                    disabled={isPending}
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
