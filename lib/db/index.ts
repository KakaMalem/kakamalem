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
