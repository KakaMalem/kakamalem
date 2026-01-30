"use client";

import { useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  WifiLow,
  RefreshCw,
  CloudOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useConnectivityStore,
  useConnectivityStatus,
} from "@/lib/stores/use-connectivity-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePOSOffline } from "./pos-offline-provider";
import {
  getSyncQueueStatus,
  processSyncQueue,
  resetFailedItems,
} from "@/lib/offline/sync-queue";

export function ConnectivityIndicator() {
  const status = useConnectivityStatus();
  const latency = useConnectivityStore((s) => s.latencyMs);
  const startMonitoring = useConnectivityStore((s) => s.startMonitoring);
  const stopMonitoring = useConnectivityStore((s) => s.stopMonitoring);

  // Get offline context for pending sales info
  const {
    pendingSalesCount,
    isProcessingQueue,
    isSyncing,
    cachedProductCount,
    isOfflineReady,
  } = usePOSOffline();

  const [failedCount, setFailedCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  // Check for failed items periodically
  useEffect(() => {
    const checkFailed = async () => {
      try {
        const queueStatus = await getSyncQueueStatus();
        setFailedCount(queueStatus.failed);
      } catch {
        // Ignore errors
      }
    };
    checkFailed();
    const interval = setInterval(checkFailed, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      // Reset failed items to pending status
      const resetCount = await resetFailedItems();
      if (resetCount === 0) {
        toast.info("No failed sales to retry");
        return;
      }

      toast.info(`Retrying ${resetCount} failed sale(s)...`);
      const result = await processSyncQueue();

      if (result.succeeded > 0) {
        toast.success(`Successfully synced ${result.succeeded} sale(s)`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} sale(s) still failing`);
      }

      // Refresh failed count
      const queueStatus = await getSyncQueueStatus();
      setFailedCount(queueStatus.failed);
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Failed to retry sync");
    } finally {
      setIsRetrying(false);
    }
  };

  const statusConfig = {
    online: {
      icon: Wifi,
      color: "text-green-600",
      dotColor: "bg-green-500",
      label: `Online${latency ? ` (${latency}ms)` : ""}`,
    },
    degraded: {
      icon: WifiLow,
      color: "text-amber-600",
      dotColor: "bg-amber-500",
      label: `Slow connection${latency ? ` (${latency}ms)` : ""}`,
    },
    offline: {
      icon: WifiOff,
      color: "text-red-600",
      dotColor: "bg-red-500",
      label: "Offline - Sales will sync when back online",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Show badge if there are pending or failed sales
  const totalPending = pendingSalesCount + failedCount;
  const showBadge = totalPending > 0 || isProcessingQueue;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer hover:bg-muted/50",
            status === "offline" && "bg-red-50 hover:bg-red-100",
            status === "degraded" && "bg-amber-50 hover:bg-amber-100"
          )}
        >
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isProcessingQueue || isSyncing ? "animate-pulse" : "",
              config.dotColor
            )}
          />
          <Icon className={cn("size-4", config.color)} />

          {/* Badge for pending/failed sales */}
          {showBadge && (
            <Badge
              variant={failedCount > 0 ? "destructive" : "secondary"}
              className={cn(
                "absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] font-medium",
                isProcessingQueue && "animate-pulse"
              )}
            >
              {isProcessingQueue ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : (
                totalPending
              )}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-64">
        <div className="space-y-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
            <span className="text-sm font-medium">{config.label}</span>
          </div>

          {/* Offline Ready Status */}
          {isOfflineReady && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CloudOff className="size-3.5" />
              <span>{cachedProductCount} products cached for offline</span>
            </div>
          )}

          {/* Pending Sales */}
          {pendingSalesCount > 0 && (
            <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <span className="font-medium">{pendingSalesCount}</span> sale(s)
              waiting to sync
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessingQueue && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Syncing sales to server...</span>
            </div>
          )}

          {/* Failed Sales with Retry */}
          {failedCount > 0 && (
            <div className="space-y-2">
              <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
                <span className="font-medium">{failedCount}</span> sale(s)
                failed to sync
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleRetryFailed}
                disabled={isRetrying || status === "offline"}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 size-3.5" />
                    Retry Failed Sales
                  </>
                )}
              </Button>
              {status === "offline" && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Connect to internet to retry
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
