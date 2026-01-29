"use client";

import { useEffect } from "react";
import { Wifi, WifiOff, WifiLow } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConnectivityStore,
  useConnectivityStatus,
} from "@/lib/stores/use-connectivity-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectivityIndicator() {
  const status = useConnectivityStatus();
  const latency = useConnectivityStore((s) => s.latencyMs);
  const startMonitoring = useConnectivityStore((s) => s.startMonitoring);
  const stopMonitoring = useConnectivityStore((s) => s.stopMonitoring);

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
            status === "offline" && "bg-red-50",
            status === "degraded" && "bg-amber-50"
          )}
        >
          <div
            className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              config.dotColor
            )}
          />
          <Icon className={cn("size-4", config.color)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
