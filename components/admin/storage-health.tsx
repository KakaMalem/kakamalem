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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HardDrive,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Trash2,
  FileWarning,
  Database,
  FolderOpen,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// Types
// =============================================================================

interface StorageAnalytics {
  timestamp: string;
  summary: {
    totalFilesOnDisk: number;
    totalFilesInDb: number;
    orphanedFiles: number;
    totalStorageUsed: number;
    orphanedStorageUsed: number;
    tenantCount: number;
  };
  byTenant: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    filesOnDisk: number;
    filesInDb: number;
    orphanedFiles: number;
    totalSizeOnDisk: number;
    orphanedSize: number;
  }>;
  orphanedFilesList: Array<{
    path: string;
    size: number;
    mtime: string;
    tenantId: string | null;
  }>;
  tempFiles: Array<{
    path: string;
    size: number;
    mtime: string;
  }>;
}

interface CleanupResult {
  action: string;
  dryRun: boolean;
  filesDeleted: number;
  bytesReclaimed: number;
  errors: string[];
  deletedPaths: string[];
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// Sub-components
// =============================================================================

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
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  subValue,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "danger";
}) {
  const bgColors = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-600",
    danger: "bg-red-100 text-red-600",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className={`rounded-md p-2 ${bgColors[variant]}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function StorageHealth() {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/storage");

      if (!response.ok) {
        if (response.status === 401) throw new Error("Authentication required");
        if (response.status === 403) throw new Error("Admin access required");
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAnalytics(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleCleanup = async (action: string, dryRun: boolean) => {
    setCleaning(true);
    try {
      const response = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dryRun }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: CleanupResult = await response.json();

      if (dryRun) {
        toast.info(
          `Dry run: Would delete ${result.filesDeleted} files (${formatBytes(result.bytesReclaimed)})`
        );
      } else {
        toast.success(
          `Deleted ${result.filesDeleted} files, reclaimed ${formatBytes(result.bytesReclaimed)}`
        );
        // Refresh analytics
        fetchAnalytics();
      }

      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors occurred during cleanup`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchAnalytics();
  };

  if (loading && !analytics) {
    return <LoadingState />;
  }

  if (error && !analytics) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <FileWarning className="mb-2 size-8 text-red-500" />
          <p className="font-medium">Failed to load storage analytics</p>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const hasOrphans = analytics.summary.orphanedFiles > 0;
  const hasTempFiles = analytics.tempFiles.length > 0;
  const orphanPercentage =
    analytics.summary.totalFilesOnDisk > 0
      ? Math.round(
          (analytics.summary.orphanedFiles /
            analytics.summary.totalFilesOnDisk) *
            100
        )
      : 0;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground" />
              <CardTitle className="text-base font-medium">
                Storage Health
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasOrphans && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800"
                >
                  {analytics.summary.orphanedFiles} orphans
                </Badge>
              )}
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
                <TooltipContent>Refresh storage analytics</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {lastUpdated && (
            <CardDescription className="text-xs">
              Last scanned: {lastUpdated.toLocaleTimeString()}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Warning Banner */}
          {hasOrphans && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {analytics.summary.orphanedFiles} orphaned files using{" "}
                {formatBytes(analytics.summary.orphanedStorageUsed)}
              </span>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox
              label="Total Storage"
              value={formatBytes(analytics.summary.totalStorageUsed)}
              subValue={`${analytics.summary.totalFilesOnDisk} files`}
              icon={HardDrive}
            />
            <StatBox
              label="Files in Database"
              value={analytics.summary.totalFilesInDb.toLocaleString()}
              subValue={`${analytics.summary.tenantCount} tenants`}
              icon={Database}
            />
            <StatBox
              label="Orphaned Files"
              value={analytics.summary.orphanedFiles.toLocaleString()}
              subValue={formatBytes(analytics.summary.orphanedStorageUsed)}
              icon={FileWarning}
              variant={hasOrphans ? "warning" : "default"}
            />
            <StatBox
              label="Temp Files"
              value={analytics.tempFiles.length.toLocaleString()}
              subValue={formatBytes(
                analytics.tempFiles.reduce((sum, f) => sum + f.size, 0)
              )}
              icon={FolderOpen}
              variant={hasTempFiles ? "warning" : "default"}
            />
          </div>

          {/* Orphan Progress */}
          {analytics.summary.totalFilesOnDisk > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Files tracked in database
                </span>
                <span>{100 - orphanPercentage}%</span>
              </div>
              <Progress
                value={100 - orphanPercentage}
                className={`h-2 ${orphanPercentage > 10 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`}
              />
            </div>
          )}

          {/* Cleanup Actions */}
          {(hasOrphans || hasTempFiles) && (
            <div className="flex flex-wrap gap-2">
              {hasOrphans && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cleaning}
                    onClick={() => handleCleanup("cleanup-orphans", true)}
                  >
                    {cleaning ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <FileWarning className="mr-2 size-4" />
                    )}
                    Preview Orphan Cleanup
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={cleaning}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete Orphans
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete orphaned files?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete{" "}
                          {analytics.summary.orphanedFiles} files (
                          {formatBytes(analytics.summary.orphanedStorageUsed)})
                          that are not tracked in the database. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() =>
                            handleCleanup("cleanup-orphans", false)
                          }
                        >
                          Delete Files
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {hasTempFiles && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cleaning}
                  onClick={() => handleCleanup("cleanup-temp", false)}
                >
                  <FolderOpen className="mr-2 size-4" />
                  Clean Temp Files
                </Button>
              )}
            </div>
          )}

          {/* No Issues State */}
          {!hasOrphans && !hasTempFiles && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>No orphaned files detected. Storage is healthy.</span>
            </div>
          )}

          {/* Expandable Details */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span className="text-xs text-muted-foreground">
                  {isExpanded ? "Hide" : "Show"} detailed breakdown
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 pt-4">
              {/* Per-Tenant Breakdown */}
              {analytics.byTenant.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Storage by Tenant</h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant</TableHead>
                          <TableHead className="text-right">Files</TableHead>
                          <TableHead className="text-right">Size</TableHead>
                          <TableHead className="text-right">Orphans</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.byTenant.slice(0, 10).map((tenant) => (
                          <TableRow key={tenant.tenantId}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {tenant.tenantName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {tenant.tenantSlug}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {tenant.filesOnDisk}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatBytes(tenant.totalSizeOnDisk)}
                            </TableCell>
                            <TableCell className="text-right">
                              {tenant.orphanedFiles > 0 ? (
                                <span className="text-amber-600">
                                  {tenant.orphanedFiles} (
                                  {formatBytes(tenant.orphanedSize)})
                                </span>
                              ) : (
                                <span className="text-green-600">0</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {analytics.byTenant.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      Showing top 10 of {analytics.byTenant.length} tenants
                    </p>
                  )}
                </div>
              )}

              {/* Orphaned Files List */}
              {analytics.orphanedFilesList.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Orphaned Files</h4>
                  <div className="max-h-48 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Path</TableHead>
                          <TableHead className="text-right">Size</TableHead>
                          <TableHead className="text-right">Modified</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.orphanedFilesList.map((file, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-xs truncate font-mono text-xs">
                              {file.path}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatBytes(file.size)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatDate(file.mtime)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {analytics.summary.orphanedFiles > 100 && (
                    <p className="text-xs text-muted-foreground">
                      Showing first 100 of {analytics.summary.orphanedFiles}{" "}
                      orphaned files
                    </p>
                  )}
                </div>
              )}

              {/* Temp Files */}
              {analytics.tempFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Temporary Files</h4>
                  <div className="max-h-32 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Path</TableHead>
                          <TableHead className="text-right">Size</TableHead>
                          <TableHead className="text-right">Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.tempFiles.map((file, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-xs truncate font-mono text-xs">
                              {file.path.split("/").pop()}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatBytes(file.size)}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatDate(file.mtime)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
