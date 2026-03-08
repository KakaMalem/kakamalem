/**
 * Shared middleware utilities for the AutoDS Sales Channel API.
 *
 * Provides:
 *  - In-memory sliding-window rate limiter (per tenant + route)
 *  - Zod validation helper that returns a NextResponse on failure
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod/v4";

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

interface RateLimitWindow {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * This is suitable for single-instance deployments / development.
 * For multi-instance production swap the Map for an upstash/redis store.
 */
const rateLimitStore = new Map<string, RateLimitWindow>();

const RATE_LIMIT_CONFIG = {
  /** Max requests per window */
  maxRequests: 60,
  /** Window size in milliseconds (1 minute) */
  windowMs: 60_000,
} as const;

/**
 * Returns a 429 NextResponse if the caller has exceeded the rate limit,
 * or `null` if the request is allowed through.
 *
 * The key is `tenantId:route` so different routes share independent buckets.
 */
export function checkRateLimit(
  tenantId: string,
  route: string
): NextResponse | null {
  const key = `${tenantId}:${route}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    // Start a fresh window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (entry.count >= RATE_LIMIT_CONFIG.maxRequests) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_CONFIG.windowMs - (now - entry.windowStart)) / 1000
    );
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down.",
        retryAfterSeconds: retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_CONFIG.maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  entry.count++;
  return null;
}

// ---------------------------------------------------------------------------
// Zod Validation Helper
// ---------------------------------------------------------------------------

/**
 * Parse and validate a request body against a Zod schema.
 *
 * Returns `{ data }` on success or `{ error: NextResponse }` on failure so
 * callers can early-return the error response.
 *
 * @example
 * const parsed = await validateBody(req, MySchema);
 * if ("error" in parsed) return parsed.error;
 * const { data } = parsed;
 */
export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));

    return {
      error: NextResponse.json(
        { error: "Validation failed", issues },
        { status: 422 }
      ),
    };
  }

  return { data: result.data };
}
