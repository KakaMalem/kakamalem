import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Create a singleton pattern for development to prevent connection exhaustion
// during hot reloading
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

// Disable prefetch as it is not supported for "Transaction" pool mode
// Limit max connections to prevent pool exhaustion
const client =
  globalForDb.client ??
  postgres(connectionString, {
    prepare: false,
    max: 10, // Limit connections
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 10, // Connection timeout
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

/**
 * Create a database client with RLS context for the authenticated user
 * This sets the auth.uid() session variable so RLS policies work correctly
 */
export async function getDbWithRLS() {
  const { getUser } = await import("@/lib/supabase/auth");
  const user = await getUser();

  if (!user) {
    // Return regular db client if no user (public access)
    return db;
  }

  // Set the user context for RLS
  // This makes auth.uid() return the current user's ID in RLS policies
  await client`SELECT set_config('request.jwt.claims', '{"sub":"${client(user.id)}"}', TRUE)`;

  return db;
}
