"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Database,
  Server,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  XCircle,
  Activity,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface SystemMetrics {
  timestamp: string;
  status: "healthy" | "degraded" | "unhealthy";
  cpu: {
    cores: number;
    model: string;
    speed: number;
    loadAverage: {
      "1min": number;
      "5min": number;
      "15min": number;
    };
    usage: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    node: {
      heapTotal: number;
      heapUsed: number;
      external: number;
      rss: number;
      arrayBuffers: number;
    };
  };
  disk: Array<{
    path: string;
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  }>;
  database: {
    status: "ok" | "error";
    latency?: number;
    error?: string;
    connections?: {
      active: number;
      idle: number;
      total: number;
      maxConnections: number;
    };
  };
  pgbouncer: {
    status: "ok" | "error" | "unavailable";
    pools?: Array<{
      database: string;
      user: string;
      activeConnections: number;
      waitingClients: number;
      serverConnections: number;
      maxWait: number;
    }>;
    error?: string;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    uptime: number;
    uptimeFormatted: string;
    v8HeapStats: {
      totalHeapSize: number;
      usedHeapSize: number;
      heapSizeLimit: number;
      mallocedMemory: number;
      peakMallocedMemory: number;
    };
  };
  warnings: string[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

function getStatusColor(status: "healthy" | "degraded" | "unhealthy"): string {
  switch (status) {
    case "healthy":
      return "bg-green-500";
    case "degraded":
      return "bg-amber-500";
    case "unhealthy":
      return "bg-red-500";
  }
}

function getStatusBadgeVariant(
  status: "healthy" | "degraded" | "unhealthy"
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "healthy":
      return "default";
    case "degraded":
      return "secondary";
    case "unhealthy":
      return "destructive";
  }
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return "text-red-600";
  if (percent >= 70) return "text-amber-600";
  return "text-green-600";
}

function getProgressColor(percent: number): string {
  if (percent >= 90) return "[&>div]:bg-red-500";
  if (percent >= 70) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-green-500";
}

// =============================================================================
// Sub-components
// =============================================================================

function MetricCard({
  icon: Icon,
  title,
  value,
  subValue,
  progress,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subValue?: string;
  progress?: number;
  status?: "ok" | "error" | "warning";
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div
        className={`rounded-md p-2 ${
          status === "error"
            ? "bg-red-100 text-red-600"
            : status === "warning"
              ? "bg-amber-100 text-amber-600"
              : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="font-semibold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
        {progress !== undefined && (
          <Progress
            value={progress}
            className={`mt-2 h-1.5 ${getProgressColor(progress)}`}
          />
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-red-200">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <XCircle className="mb-2 size-8 text-red-500" />
        <p className="font-medium">Failed to load system metrics</p>
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/health/system");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required");
        }
        if (response.status === 403) {
          throw new Error("Admin access required");
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
  };

  if (loading && !metrics) {
    return <LoadingState />;
  }

  if (error && !metrics) {
    return <ErrorState error={error} onRetry={handleRefresh} />;
  }

  if (!metrics) {
    return null;
  }

  const heapUsagePercent = Math.round(
    (metrics.memory.node.heapUsed / metrics.memory.node.heapTotal) * 100
  );

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`size-2 rounded-full ${getStatusColor(metrics.status)}`}
              />
              <CardTitle className="text-base font-medium">
                System Health
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant(metrics.status)}>
                {metrics.status.charAt(0).toUpperCase() +
                  metrics.status.slice(1)}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`size-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh metrics</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {lastUpdated && (
            <CardDescription className="text-xs">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Warnings */}
          {metrics.warnings.length > 0 && (
            <div className="space-y-2">
              {metrics.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          {/* Primary Metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* CPU */}
            <MetricCard
              icon={Cpu}
              title="CPU Usage"
              value={`${metrics.cpu.usage}%`}
              subValue={`${metrics.cpu.cores} cores @ ${metrics.cpu.speed} MHz`}
              progress={metrics.cpu.usage}
              status={
                metrics.cpu.usage > 90
                  ? "error"
                  : metrics.cpu.usage > 70
                    ? "warning"
                    : "ok"
              }
            />

            {/* Memory */}
            <MetricCard
              icon={MemoryStick}
              title="Memory"
              value={`${metrics.memory.usagePercent}%`}
              subValue={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
              progress={metrics.memory.usagePercent}
              status={
                metrics.memory.usagePercent > 90
                  ? "error"
                  : metrics.memory.usagePercent > 80
                    ? "warning"
                    : "ok"
              }
            />

            {/* Disk */}
            {metrics.disk[0] && (
              <MetricCard
                icon={HardDrive}
                title={`Disk (${metrics.disk[0].path})`}
                value={`${metrics.disk[0].usagePercent}%`}
                subValue={`${formatBytes(metrics.disk[0].free)} free`}
                progress={metrics.disk[0].usagePercent}
                status={
                  metrics.disk[0].usagePercent > 95
                    ? "error"
                    : metrics.disk[0].usagePercent > 85
                      ? "warning"
                      : "ok"
                }
              />
            )}

            {/* Database */}
            <MetricCard
              icon={Database}
              title="Database"
              value={
                metrics.database.status === "ok"
                  ? `${metrics.database.latency}ms`
                  : "Error"
              }
              subValue={
                metrics.database.connections
                  ? `${metrics.database.connections.active} active / ${metrics.database.connections.maxConnections} max`
                  : metrics.database.error
              }
              status={
                metrics.database.status === "error"
                  ? "error"
                  : metrics.database.latency && metrics.database.latency > 100
                    ? "warning"
                    : "ok"
              }
            />
          </div>

          {/* Expandable Details */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? "Hide" : "Show"} detailed metrics
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 pt-4">
              {/* Node.js Runtime */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Server className="size-4" />
                  Node.js Runtime
                </h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border px-3 py-2">
                    <span className="text-muted-foreground">Version: </span>
                    <span className="font-mono">
                      {metrics.runtime.nodeVersion}
                    </span>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <span className="text-muted-foreground">Uptime: </span>
                    <span className="font-mono">
                      {metrics.runtime.uptimeFormatted}
                    </span>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <span className="text-muted-foreground">Platform: </span>
                    <span className="font-mono">
                      {metrics.runtime.platform}/{metrics.runtime.arch}
                    </span>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <span className="text-muted-foreground">PID: </span>
                    <span className="font-mono">{metrics.runtime.pid}</span>
                  </div>
                </div>
              </div>

              {/* V8 Heap */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="size-4" />
                  V8 Heap Memory
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Heap Used</span>
                      <span className={getUsageColor(heapUsagePercent)}>
                        {formatBytes(metrics.memory.node.heapUsed)} /{" "}
                        {formatBytes(metrics.memory.node.heapTotal)} (
                        {heapUsagePercent}%)
                      </span>
                    </div>
                    <Progress
                      value={heapUsagePercent}
                      className={`h-2 ${getProgressColor(heapUsagePercent)}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">RSS</span>
                      <span>{formatBytes(metrics.memory.node.rss)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">External</span>
                      <span>{formatBytes(metrics.memory.node.external)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CPU Load Average */}
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="size-4" />
                  Load Average
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md border px-3 py-2">
                    <p className="text-muted-foreground">1 min</p>
                    <p className="font-mono font-semibold">
                      {metrics.cpu.loadAverage["1min"]}
                    </p>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <p className="text-muted-foreground">5 min</p>
                    <p className="font-mono font-semibold">
                      {metrics.cpu.loadAverage["5min"]}
                    </p>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <p className="text-muted-foreground">15 min</p>
                    <p className="font-mono font-semibold">
                      {metrics.cpu.loadAverage["15min"]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Disks */}
              {metrics.disk.length > 1 && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <HardDrive className="size-4" />
                    Storage Volumes
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {metrics.disk.map((disk, i) => (
                      <div key={i} className="space-y-1 rounded-md border p-3">
                        <div className="flex justify-between text-sm">
                          <span className="font-mono text-muted-foreground">
                            {disk.path}
                          </span>
                          <span className={getUsageColor(disk.usagePercent)}>
                            {disk.usagePercent}%
                          </span>
                        </div>
                        <Progress
                          value={disk.usagePercent}
                          className={`h-2 ${getProgressColor(disk.usagePercent)}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatBytes(disk.used)} used</span>
                          <span>{formatBytes(disk.free)} free</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Database Connections */}
              {metrics.database.connections && (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-medium">
                    <Database className="size-4" />
                    Database Connections
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="rounded-md border px-3 py-2">
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-mono font-semibold text-green-600">
                        {metrics.database.connections.active}
                      </p>
                    </div>
                    <div className="rounded-md border px-3 py-2">
                      <p className="text-muted-foreground">Idle</p>
                      <p className="font-mono font-semibold text-amber-600">
                        {metrics.database.connections.idle}
                      </p>
                    </div>
                    <div className="rounded-md border px-3 py-2">
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-mono font-semibold">
                        {metrics.database.connections.total}
                      </p>
                    </div>
                    <div className="rounded-md border px-3 py-2">
                      <p className="text-muted-foreground">Max</p>
                      <p className="font-mono font-semibold">
                        {metrics.database.connections.maxConnections}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
