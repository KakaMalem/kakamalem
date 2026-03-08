"use client";

import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  Zap,
  Package,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncAliExpressProductAction } from "@/lib/actions/source-sync";

interface ProductSourceBadgeProps {
  sourceType: "manual" | "aliexpress" | "amazon" | "autods";
  sourceId?: string | null;
  sourceUrl?: string | null;
  lastSyncedAt?: string | null;
  syncEnabled?: boolean;
  className?: string;
  productId?: string;
  tenantId?: string;
}

export function ProductSourceBadge({
  sourceType,
  sourceId: _sourceId,
  sourceUrl,
  lastSyncedAt,
  syncEnabled = true,
  className,
  productId,
  tenantId,
}: ProductSourceBadgeProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  if (sourceType === "manual") return null;

  const handleManualSync = async () => {
    if (!productId || !tenantId) return;

    setIsSyncing(true);
    toast.loading("Syncing with AliExpress...", { id: "sync-toast" });

    try {
      const result = await syncAliExpressProductAction(productId, tenantId);

      if (result.success) {
        if ("hasPriceChanged" in result && result.hasPriceChanged) {
          toast.success(
            `Synced successfully! Price changed to $${"newPrice" in result ? result.newPrice : ""}`,
            { id: "sync-toast" }
          );
        } else {
          toast.success("Synced successfully! No price changes detected.", {
            id: "sync-toast",
          });
        }
      } else {
        toast.error(
          `Sync failed: ${("error" in result ? result.error : undefined) || ("reason" in result ? result.reason : undefined) || "Unknown error"}`,
          {
            id: "sync-toast",
          }
        );
      }
    } catch (_e) {
      toast.error("An unexpected error occurred during sync", {
        id: "sync-toast",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const sourceConfigs: Record<
    string,
    { label: string; icon: React.ElementType; color: string }
  > = {
    aliexpress: {
      label: "AliExpress",
      icon: ShoppingBag,
      color:
        "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20",
    },
    amazon: {
      label: "Amazon",
      icon: Package,
      color:
        "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 hover:bg-yellow-500/20",
    },
    autods: {
      label: "AutoDS",
      icon: Zap,
      color:
        "bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20",
    },
  };

  const config = sourceConfigs[sourceType as keyof typeof sourceConfigs] || {
    label: sourceType,
    icon: RefreshCw,
    color: "bg-muted text-muted-foreground",
  };

  const Icon = config.icon;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn("gap-1.5 py-1 px-2 font-medium", config.color)}
      >
        <Icon className="size-3.5" />
        {config.label}
      </Badge>

      {sourceUrl && (
        <Link
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          View Original <ExternalLink className="size-3" />
        </Link>
      )}

      {lastSyncedAt && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1 ml-1">
          <RefreshCw className="size-2.5" />
          Synced{" "}
          {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
        </span>
      )}

      {sourceType === "aliexpress" && productId && tenantId && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] uppercase font-semibold tracking-wider px-2"
          onClick={handleManualSync}
          disabled={isSyncing || !syncEnabled}
        >
          <RefreshCw
            className={cn("size-3 mr-1", isSyncing && "animate-spin")}
          />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>
      )}

      {!syncEnabled && (
        <Badge
          variant="outline"
          className="text-[10px] py-0 px-1 bg-muted text-muted-foreground"
        >
          Sync Paused
        </Badge>
      )}
    </div>
  );
}
