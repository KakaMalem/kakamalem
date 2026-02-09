"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Power,
  PowerOff,
  Calendar,
  Percent,
  Tag,
  Store,
  FolderOpen,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import { formatPrice, cn } from "@/lib/utils";
import type { CampaignWithStats } from "@/lib/db/queries/campaigns";
import type { CampaignStatus } from "@/lib/validations/campaigns";
import {
  deleteCampaignAction,
  toggleCampaignStatusAction,
  duplicateCampaignAction,
} from "@/lib/actions/campaigns";

interface CampaignsListProps {
  campaigns: CampaignWithStats[];
  storeSlug: string;
  tenantId: string;
  currency: string;
}

const statusConfig: Record<
  CampaignStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  active: { label: "Active", variant: "default" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  ended: { label: "Ended", variant: "outline" },
  inactive: { label: "Inactive", variant: "destructive" },
};

const scopeIcons = {
  store_wide: Store,
  categories: FolderOpen,
  products: Package,
};

const scopeLabels = {
  store_wide: "Store-wide",
  categories: "Categories",
  products: "Products",
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: start.getFullYear() !== end.getFullYear() ? "numeric" : undefined,
    });

  return `${formatDate(start)} - ${formatDate(end)}`;
}

export function CampaignsList({
  campaigns,
  storeSlug,
  tenantId,
  currency,
}: CampaignsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggleStatus = (campaignId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleCampaignStatusAction(
        tenantId,
        storeSlug,
        campaignId,
        !currentStatus
      );
      if (result.success) {
        toast.success(currentStatus ? "Campaign paused" : "Campaign activated");
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to update campaign");
      }
    });
  };

  const handleDuplicate = (campaignId: string) => {
    startTransition(async () => {
      const result = await duplicateCampaignAction(
        tenantId,
        storeSlug,
        campaignId
      );
      if (result.success) {
        toast.success("Campaign duplicated");
        router.push(`/dashboard/${storeSlug}/campaigns/${result.data?.id}`);
      } else {
        toast.error(result.error?.message || "Failed to duplicate campaign");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteCampaignAction(tenantId, storeSlug, deleteId);
      if (result.success) {
        toast.success("Campaign deleted");
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to delete campaign");
      }
      setDeleteId(null);
    });
  };

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Calendar className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">No sale campaigns yet</CardTitle>
          <CardDescription className="text-center max-w-md mb-4">
            Create your first sale campaign to offer automatic discounts during
            special events like Black Friday, Eid, or seasonal sales.
          </CardDescription>
          <Button asChild>
            <Link href={`/dashboard/${storeSlug}/campaigns/new`}>
              Create Campaign
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const status = statusConfig[campaign.status];
          const ScopeIcon = scopeIcons[campaign.scope];

          return (
            <Card
              key={campaign.id}
              className={cn(
                "relative",
                campaign.status === "active" &&
                  "border-green-200 bg-green-50/30"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDateRange(campaign.startsAt, campaign.endsAt)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/${storeSlug}/campaigns/${campaign.id}`}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(campaign.id)}
                      >
                        <Copy className="mr-2 size-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          handleToggleStatus(campaign.id, campaign.isActive)
                        }
                      >
                        {campaign.isActive ? (
                          <>
                            <PowerOff className="mr-2 size-4" />
                            Pause Campaign
                          </>
                        ) : (
                          <>
                            <Power className="mr-2 size-4" />
                            Activate Campaign
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(campaign.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status and Discount */}
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant="outline" className="gap-1">
                    {campaign.discountType === "percentage" ? (
                      <>
                        <Percent className="size-3" />
                        {campaign.discountValue}% OFF
                      </>
                    ) : (
                      <>
                        <Tag className="size-3" />
                        {formatPrice(
                          parseFloat(campaign.discountValue),
                          currency
                        )}{" "}
                        OFF
                      </>
                    )}
                  </Badge>
                </div>

                {/* Scope */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ScopeIcon className="size-4" />
                  <span>{scopeLabels[campaign.scope]}</span>
                  {campaign.scope === "categories" &&
                    campaign.categoryCount > 0 && (
                      <span className="text-xs">
                        ({campaign.categoryCount} categor
                        {campaign.categoryCount === 1 ? "y" : "ies"})
                      </span>
                    )}
                  {campaign.scope === "products" &&
                    campaign.productCount > 0 && (
                      <span className="text-xs">
                        ({campaign.productCount} product
                        {campaign.productCount === 1 ? "" : "s"})
                      </span>
                    )}
                </div>

                {/* Badge text preview */}
                {campaign.showBadge && campaign.badgeText && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Badge:
                    </span>
                    <Badge className="bg-red-500 text-white text-xs">
                      {campaign.badgeText}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sale campaign. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
