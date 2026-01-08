import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// =============================================================================
// BETTER AUTH API ROUTE
// =============================================================================
// Handles all auth endpoints: /api/auth/*
// - /api/auth/sign-in
// - /api/auth/sign-up
// - /api/auth/sign-out
// - /api/auth/session
// - /api/auth/callback/[provider]
// - /api/auth/verify-email
// - /api/auth/forget-password
// - /api/auth/reset-password
// - etc.
// =============================================================================

export const { GET, POST } = toNextJsHandler(auth);
