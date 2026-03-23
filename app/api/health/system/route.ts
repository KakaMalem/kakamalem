import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import * as os from "os";
import * as v8 from "v8";
import { exec } from "child_process";
import { promisify } from "util";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

interface CpuMetrics {
  cores: number;
  model: string;
  speed: number; // MHz
  loadAverage: {
    "1min": number;
    "5min": number;
    "15min": number;
  };
  usage: number; // Percentage (calculated from load avg / cores)
}

interface MemoryMetrics {
  total: number; // bytes
  free: number;
  used: number;
  usagePercent: number;
  node: {
    heapTotal: number;
    heapUsed: number;
    external: number;
    rss: number; // Resident Set Size
    arrayBuffers: number;
  };
}

interface DiskMetrics {
  path: string;
  total: number; // bytes
  used: number;
  free: number;
  usagePercent: number;
}

interface DatabaseMetrics {
  status: "ok" | "error";
  latency?: number;
  error?: string;
  connections?: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
  };
}

interface PgBouncerMetrics {
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
}

interface RuntimeMetrics {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptime: number; // seconds
  uptimeFormatted: string;
  v8HeapStats: {
    totalHeapSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    mallocedMemory: number;
    peakMallocedMemory: number;
  };
}

interface SystemMetrics {
  timestamp: string;
  status: "healthy" | "degraded" | "unhealthy";
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics[];
  database: DatabaseMetrics;
  pgbouncer: PgBouncerMetrics;
  runtime: RuntimeMetrics;
  warnings: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

function getCpuMetrics(): CpuMetrics {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const cores = cpus.length;

  return {
    cores,
    model: cpus[0]?.model || "Unknown",
    speed: cpus[0]?.speed || 0,
    loadAverage: {
      "1min": Math.round(loadAvg[0] * 100) / 100,
      "5min": Math.round(loadAvg[1] * 100) / 100,
      "15min": Math.round(loadAvg[2] * 100) / 100,
    },
    // Usage as percentage of total capacity (load / cores * 100)
    usage: Math.min(100, Math.round((loadAvg[0] / cores) * 100 * 100) / 100),
  };
}

function getMemoryMetrics(): MemoryMetrics {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const nodeMemory = process.memoryUsage();

  return {
    total,
    free,
    used,
    usagePercent: Math.round((used / total) * 100 * 100) / 100,
    node: {
      heapTotal: nodeMemory.heapTotal,
      heapUsed: nodeMemory.heapUsed,
      external: nodeMemory.external,
      rss: nodeMemory.rss,
      arrayBuffers: nodeMemory.arrayBuffers,
    },
  };
}

async function getDiskMetrics(): Promise<DiskMetrics[]> {
  const disks: DiskMetrics[] = [];

  // Paths to check - adjust based on your setup
  const pathsToCheck = [
    { path: "/", name: "Root" },
    { path: "/var/www/kakamalem-uploads", name: "Uploads" },
  ];

  // On Windows (dev), use different paths
  if (process.platform === "win32") {
    pathsToCheck.length = 0;
    pathsToCheck.push({ path: "C:", name: "System" });
  }

  for (const { path } of pathsToCheck) {
    try {
      if (process.platform === "win32") {
        // Windows: use wmic
        const { stdout } = await execAsync(
          `wmic logicaldisk where "DeviceID='${path}'" get Size,FreeSpace /format:csv`
        );
        const lines = stdout.trim().split("\n").filter(Boolean);
        if (lines.length >= 2) {
          const values = lines[1].split(",");
          const free = parseInt(values[1]) || 0;
          const total = parseInt(values[2]) || 0;
          const used = total - free;
          disks.push({
            path,
            total,
            used,
            free,
            usagePercent:
              total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0,
          });
        }
      } else {
        // Linux/macOS: use df
        const { stdout } = await execAsync(
          `df -B1 "${path}" 2>/dev/null | tail -1`
        );
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 4) {
          const total = parseInt(parts[1]) || 0;
          const used = parseInt(parts[2]) || 0;
          const free = parseInt(parts[3]) || 0;
          disks.push({
            path,
            total,
            used,
            free,
            usagePercent:
              total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0,
          });
        }
      }
    } catch {
      // Path might not exist, skip it
    }
  }

  return disks;
}

async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  try {
    const start = Date.now();

    // Check connection and verify schema version/completeness
    const result = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle,
        (SELECT count(*) FROM pg_stat_activity) as total,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(checkout_address_mode) FROM tenants LIMIT 1) as schema_check
    `);

    const latency = Date.now() - start;
    const row = result[0] as {
      active: string;
      idle: string;
      total: string;
      max_connections: string;
    };

    return {
      status: "ok",
      latency,
      connections: {
        active: parseInt(row.active) || 0,
        idle: parseInt(row.idle) || 0,
        total: parseInt(row.total) || 0,
        maxConnections: parseInt(row.max_connections) || 100,
      },
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

async function getPgBouncerMetrics(): Promise<PgBouncerMetrics> {
  // PgBouncer stats are available through the admin console
  // This requires connecting to the pgbouncer database on port 6543
  // with appropriate credentials configured in pgbouncer.ini
  //
  // For now, return unavailable since this requires separate connection
  // In production, you could add a separate db client for PgBouncer admin
  return {
    status: "unavailable",
    error: "PgBouncer admin stats require separate configuration",
  };
}

function getRuntimeMetrics(): RuntimeMetrics {
  const heapStats = v8.getHeapStatistics();
  const uptime = process.uptime();

  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime,
    uptimeFormatted: formatUptime(uptime),
    v8HeapStats: {
      totalHeapSize: heapStats.total_heap_size,
      usedHeapSize: heapStats.used_heap_size,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
    },
  };
}

function determineOverallStatus(
  cpu: CpuMetrics,
  memory: MemoryMetrics,
  disk: DiskMetrics[],
  database: DatabaseMetrics
): { status: "healthy" | "degraded" | "unhealthy"; warnings: string[] } {
  const warnings: string[] = [];
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Database check (critical)
  if (database.status === "error") {
    status = "unhealthy";
    warnings.push("Database connection failed");
  }

  // CPU check
  if (cpu.usage > 90) {
    status = status === "unhealthy" ? "unhealthy" : "degraded";
    warnings.push(`High CPU usage: ${cpu.usage}%`);
  } else if (cpu.usage > 70) {
    warnings.push(`Elevated CPU usage: ${cpu.usage}%`);
  }

  // Memory check
  if (memory.usagePercent > 90) {
    status = status === "unhealthy" ? "unhealthy" : "degraded";
    warnings.push(`Critical memory usage: ${memory.usagePercent}%`);
  } else if (memory.usagePercent > 80) {
    warnings.push(`High memory usage: ${memory.usagePercent}%`);
  }

  // Disk check
  for (const d of disk) {
    if (d.usagePercent > 95) {
      status = status === "unhealthy" ? "unhealthy" : "degraded";
      warnings.push(`Critical disk usage on ${d.path}: ${d.usagePercent}%`);
    } else if (d.usagePercent > 85) {
      warnings.push(`High disk usage on ${d.path}: ${d.usagePercent}%`);
    }
  }

  // Node.js heap check
  const heapUsagePercent = (memory.node.heapUsed / memory.node.heapTotal) * 100;
  if (heapUsagePercent > 90) {
    warnings.push(`High Node.js heap usage: ${Math.round(heapUsagePercent)}%`);
  }

  // Database latency check
  if (database.latency && database.latency > 100) {
    warnings.push(`Slow database response: ${database.latency}ms`);
  }

  return { status, warnings };
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function GET(): Promise<
  NextResponse<SystemMetrics | { error: string }>
> {
  // Check authentication - only platform admins can access system metrics
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is platform admin
  const userProfile = await db.execute(sql`
    SELECT platform_role FROM user_profiles WHERE user_id = ${session.user.id}
  `);

  const platformRole = (userProfile[0] as { platform_role?: string })
    ?.platform_role;
  if (platformRole !== "platform_admin" && platformRole !== "super_admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  // Collect all metrics in parallel
  const [cpu, memory, disk, database, pgbouncer] = await Promise.all([
    getCpuMetrics(),
    getMemoryMetrics(),
    getDiskMetrics(),
    getDatabaseMetrics(),
    getPgBouncerMetrics(),
  ]);

  const runtime = getRuntimeMetrics();
  const { status, warnings } = determineOverallStatus(
    cpu,
    memory,
    disk,
    database
  );

  const metrics: SystemMetrics = {
    timestamp: new Date().toISOString(),
    status,
    cpu,
    memory,
    disk,
    database,
    pgbouncer,
    runtime,
    warnings,
  };

  return NextResponse.json(metrics);
}
