"use client";

import {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  useCallback,
} from "react";
import { toast } from "sonner";
import { OFFLINE_POS_ENABLED } from "@/lib/offline/feature-flag";
import { useConnectivityStatus } from "@/lib/stores/use-connectivity-store";
import { syncPOSData, needsSync } from "@/lib/offline/sync";
import { processSyncQueue, getSyncQueueStatus } from "@/lib/offline/sync-queue";

// ============================================================================
// CONTEXT
// ============================================================================

interface POSOfflineContextValue {
  /** Whether the POS is ready to work offline (data has been synced) */
  isOfflineReady: boolean;
  /** Whether we're currently syncing data */
  isSyncing: boolean;
  /** Whether we're currently online */
  isOnline: boolean;
  /** Force a manual sync */
  triggerSync: () => Promise<void>;
  /** Last sync timestamp */
  lastSyncedAt: Date | null;
  /** Number of products cached */
  cachedProductCount: number;
  /** Number of pending sales waiting to sync */
  pendingSalesCount: number;
  /** Whether the sync queue is currently being processed */
  isProcessingQueue: boolean;
}

const POSOfflineContext = createContext<POSOfflineContextValue>({
  isOfflineReady: false,
  isSyncing: false,
  isOnline: true,
  triggerSync: async () => {},
  lastSyncedAt: null,
  cachedProductCount: 0,
  pendingSalesCount: 0,
  isProcessingQueue: false,
});

export const usePOSOffline = () => useContext(POSOfflineContext);

// ============================================================================
// PROVIDER
// ============================================================================

interface POSOfflineProviderProps {
  children: React.ReactNode;
  tenantId: string;
  storeSlug: string;
}

export function POSOfflineProvider({
  children,
  tenantId,
  storeSlug,
}: POSOfflineProviderProps) {
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [cachedProductCount, setCachedProductCount] = useState(0);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const syncAttempted = useRef(false);
  const wasOffline = useRef(false);

  // Get connectivity status from the store
  const connectivityStatus = useConnectivityStatus();
  const isOnline = connectivityStatus !== "offline";

  // Sync function - wrapped in useCallback to avoid dependency issues
  const doSync = useCallback(async () => {
    if (!OFFLINE_POS_ENABLED) return;
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncPOSData(storeSlug);

      if (result.success) {
        setIsOfflineReady(true);
        setLastSyncedAt(new Date());
        setCachedProductCount(result.productsCount);

        // Only show toast on manual sync or first sync
        if (syncAttempted.current) {
          toast.success(
            `POS data synced: ${result.productsCount} products cached`
          );
        }
      } else {
        console.error("POS sync failed:", result.error);
        // Don't show error toast on initial sync - might just be loading
        if (syncAttempted.current) {
          toast.error(`Sync failed: ${result.error}`);
        }
      }
    } catch (error) {
      console.error("POS sync error:", error);
    } finally {
      setIsSyncing(false);
      syncAttempted.current = true;
    }
  }, [storeSlug, isSyncing]);

  // Trigger sync - exposed for manual refresh
  const triggerSync = useCallback(async () => {
    syncAttempted.current = true;
    await doSync();
  }, [doSync]);

  // Initial sync on mount when online
  useEffect(() => {
    if (!OFFLINE_POS_ENABLED) return;

    // Check if we need to sync
    const checkAndSync = async () => {
      const shouldSync = await needsSync(tenantId);
      if (shouldSync && isOnline) {
        await doSync();
      } else if (!shouldSync) {
        // Already have cached data
        setIsOfflineReady(true);
      }
    };

    checkAndSync();
  }, [tenantId, doSync, isOnline]);

  // Track offline state for detecting transitions
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    }
  }, [isOnline]);

  // Update pending sales count periodically
  useEffect(() => {
    if (!OFFLINE_POS_ENABLED) return;

    const updatePendingCount = async () => {
      try {
        const status = await getSyncQueueStatus();
        setPendingSalesCount(status.pending + status.syncing);
      } catch {
        // Ignore errors - IndexedDB might not be ready yet
      }
    };

    // Check immediately and then every 5 seconds
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Process sync queue and re-sync data when coming back online
  useEffect(() => {
    if (!OFFLINE_POS_ENABLED) return;

    const processQueueAndSync = async () => {
      // Check if we just came back online from being offline
      if (!isOnline || !wasOffline.current) return;

      // Reset the flag
      wasOffline.current = false;

      // Check for pending sales to sync
      const status = await getSyncQueueStatus();
      if (status.pending > 0) {
        setIsProcessingQueue(true);

        toast.info(`Syncing ${status.pending} offline sale(s)...`, {
          duration: 3000,
        });

        try {
          const result = await processSyncQueue();

          if (result.succeeded > 0) {
            toast.success(
              `Successfully synced ${result.succeeded} sale(s) to server`
            );
          }

          if (result.failed > 0) {
            toast.error(`${result.failed} sale(s) failed to sync`, {
              description: "Check your connection and try again",
              duration: 5000,
            });
          }

          // Update pending count
          const newStatus = await getSyncQueueStatus();
          setPendingSalesCount(newStatus.pending + newStatus.syncing);
        } catch (error) {
          console.error("Failed to process sync queue:", error);
          toast.error("Failed to sync offline sales");
        } finally {
          setIsProcessingQueue(false);
        }
      }

      // Also refresh product data from server
      if (isOfflineReady && syncAttempted.current) {
        doSync();
      }
    };

    processQueueAndSync();
  }, [isOnline, isOfflineReady, doSync]);

  // If feature is disabled, just render children
  if (!OFFLINE_POS_ENABLED) {
    return <>{children}</>;
  }

  return (
    <POSOfflineContext.Provider
      value={{
        isOfflineReady,
        isSyncing,
        isOnline,
        triggerSync,
        lastSyncedAt,
        cachedProductCount,
        pendingSalesCount,
        isProcessingQueue,
      }}
    >
      {children}
    </POSOfflineContext.Provider>
  );
}
