import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// =============================================================================
// DATABASE CONNECTION CONFIGURATION
// =============================================================================
// Uses PgBouncer on port 6543 for connection pooling
// Optimized for PostgreSQL 18 with async I/O
// =============================================================================

// Connection URLs
// - DATABASE_URL: PgBouncer pooled connection (port 6543) - for app runtime
// - DATABASE_URL_UNPOOLED: Direct PostgreSQL (port 5432) - for migrations only
const connectionString = process.env.DATABASE_URL!;

// Singleton pattern to prevent connection exhaustion during dev hot reload
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

/**
 * postgres.js client configuration
 * Optimized for PgBouncer transaction pooling mode
 */
const client =
  globalForDb.client ??
  postgres(connectionString, {
    // REQUIRED for PgBouncer transaction mode
    prepare: false,

    // Connection pool settings
    // PgBouncer handles pooling, so we keep this relatively low
    max: process.env.NODE_ENV === "production" ? 20 : 5,

    // Connection lifetime management
    idle_timeout: 30, // Close idle connections after 30 seconds
    max_lifetime: 60 * 30, // Max connection lifetime: 30 minutes
    connect_timeout: 10, // Connection timeout: 10 seconds

    // Keep connections alive
    keep_alive: 30, // TCP keepalive interval

    // Fetch all types for better performance
    fetch_types: true,

    // Connection callback for debugging
    onnotice: process.env.NODE_ENV === "development" ? console.log : undefined,

    // SSL configuration - only enable if DATABASE_SSL is explicitly set
    // Local production builds don't need SSL, only remote production databases
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,

    // Transform column names (postgres.js handles this well)
    transform: {
      undefined: null, // Transform undefined to null
    },
  });

// Cache client in development to survive hot reloads
if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

/**
 * Main database client with schema
 * Use this for all database operations
 */
export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

/**
 * Raw SQL client for when you need to execute raw queries
 * Useful for complex queries not supported by Drizzle
 */
export const sql = client;

/**
 * Execute a function within a database transaction
 * Automatically rolls back on error
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.insert(orders).values({...});
 *   await tx.update(inventory).set({...});
 * });
 */
export async function withTransaction<T>(
  fn: (
    tx: Parameters<typeof db.transaction>[0] extends (tx: infer U) => unknown
      ? U
      : never
  ) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}

/**
 * Health check function for database connectivity
 * Returns true if database is accessible
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

/**
 * Gracefully close database connections
 * Call this during application shutdown
 */
export async function closeDatabaseConnections(): Promise<void> {
  await client.end();
}

// Export types for convenience
export type Database = typeof db;
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
