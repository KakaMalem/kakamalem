import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// A small reserved pool keeps relay acceptance out of the ordinary app/worker
// pool's unbounded waiting queue. The handler admits at most this many requests.
export const WEBHOOK_CONCURRENCY = 16;
const globalForWebhook = globalThis as unknown as {
  webhookSql?: ReturnType<typeof postgres>;
};
const client =
  globalForWebhook.webhookSql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: WEBHOOK_CONCURRENCY,
    connect_timeout: 1,
    fetch_types: false,
    idle_timeout: 10,
    max_lifetime: 60 * 30,
    ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
    transform: { undefined: null },
  });
if (process.env.NODE_ENV !== "production") globalForWebhook.webhookSql = client;
export const webhookDatabase = drizzle(client, { schema });
