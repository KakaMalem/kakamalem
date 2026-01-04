import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const CART_SESSION_COOKIE = "kaka-malem-cart-session";
const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get cart session ID from cookies (read-only, safe for Server Components)
 * Returns null if no session exists - use getOrCreateCartSessionInAction for mutations
 */
export async function getCartSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_SESSION_COOKIE)?.value || null;
}

/**
 * Get existing session ID (read-only, safe for Server Components)
 * Returns null if no session exists - the session will be created
 * when the user performs a cart action (add to cart, etc.)
 */
export async function getCartSessionIdOrNull(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_SESSION_COOKIE)?.value || null;
}

/**
 * Set cart session cookie (ONLY use in Server Actions or Route Handlers)
 */
export async function setCartSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CART_SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Get existing session or create new one (ONLY use in Server Actions)
 * This both reads and writes cookies
 */
export async function getOrCreateCartSessionInAction(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set(CART_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CART_SESSION_MAX_AGE,
      path: "/",
    });
  }

  return sessionId;
}

/**
 * Clear cart session cookie (ONLY use in Server Actions, e.g., after checkout)
 */
export async function clearCartSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CART_SESSION_COOKIE);
}

export { CART_SESSION_COOKIE };
