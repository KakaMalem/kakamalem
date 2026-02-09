import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  sendEmail,
  getVerificationEmailHtml,
  getPasswordResetEmailHtml,
} from "@/lib/email";

// =============================================================================
// BETTER AUTH CONFIGURATION
// =============================================================================
// Self-hosted authentication
// Universal identity system for all portals (seller, affiliate, delivery)
// =============================================================================

export const auth = betterAuth({
  // Secret for signing tokens/cookies (REQUIRED)
  // In production, this is passed as a Docker build arg from .env
  secret: process.env.BETTER_AUTH_SECRET!,

  // Base URL for auth (used for callbacks, redirects)
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // Trust host header in production (needed behind reverse proxy)
  trustedOrigins: process.env.NEXT_PUBLIC_APP_URL
    ? [process.env.NEXT_PUBLIC_APP_URL]
    : ["http://localhost:3000"],

  // Database adapter using Drizzle
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // ==========================================================================
  // EMAIL & PASSWORD AUTHENTICATION
  // ==========================================================================
  emailAndPassword: {
    enabled: true,
    // Require email verification before allowing login
    // Disabled in development for easier testing
    requireEmailVerification: process.env.NODE_ENV === "production",
    // Password requirements
    minPasswordLength: 8,
    // Password reset email
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string; name: string | null };
      url: string;
    }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Kaka Malem password",
        html: getPasswordResetEmailHtml(url, user.name || undefined),
      });
    },
  },

  // ==========================================================================
  // SOCIAL OAUTH PROVIDERS
  // ==========================================================================
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // Facebook OAuth
    facebook: {
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
    },
  },

  // ==========================================================================
  // SESSION CONFIGURATION
  // ==========================================================================
  session: {
    // Session expires after 30 days of inactivity
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    // Update session expiry on each request
    updateAge: 60 * 60 * 24 * 7, // Update every 24 hours
    // Disable cookie cache - can cause issues with server-side session reads
    cookieCache: {
      enabled: false,
    },
  },

  // ==========================================================================
  // USER CONFIGURATION
  // ==========================================================================
  user: {
    // Additional fields to store on user creation
    additionalFields: {
      // We'll use userProfiles table for extended data
    },
    // Custom user data transformation
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
    },
  },

  // ==========================================================================
  // EMAIL CONFIGURATION
  // ==========================================================================
  emailVerification: {
    // Only send verification emails in production
    sendOnSignUp: process.env.NODE_ENV === "production",
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string; name: string | null };
      url: string;
    }) => {
      // Skip sending in development
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Verification email for ${user.email}: ${url}`);
        return;
      }
      try {
        await sendEmail({
          to: user.email,
          subject: "Verify your Kaka Malem account",
          html: getVerificationEmailHtml(url, user.name || undefined),
        });
      } catch (error) {
        // Log but don't throw - account creation should still succeed
        // User can resend verification email from the login page
        console.error(
          "Failed to send verification email to:",
          user.email,
          error instanceof Error ? error.message : error
        );
      }
    },
  },

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================
  rateLimit: {
    enabled: true,
    // Limit login attempts
    window: 60, // 1 minute window
    max: 10, // 10 attempts per window
  },

  // ==========================================================================
  // DATABASE HOOKS
  // ==========================================================================
  // Auto-create related records when users are created
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create user profile with default preferences
          await db
            .insert(schema.userProfiles)
            .values({
              userId: user.id,
              platformRole: "user",
              preferredCurrency: "AFN",
              preferredLanguage: "fa",
            })
            .onConflictDoNothing();
        },
      },
    },
  },

  // ==========================================================================
  // ADVANCED OPTIONS
  // ==========================================================================
  advanced: {
    // Use secure cookies only when serving over HTTPS
    // Check if APP_URL starts with https:// to determine if we need secure cookies
    useSecureCookies:
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
    // Cookie prefix
    cookiePrefix: "kaka_malem",
  },

  // ==========================================================================
  // PLUGINS
  // ==========================================================================
  plugins: [
    // Next.js cookie handling - must be last plugin
    // Automatically sets cookies when Set-Cookie header is present
    nextCookies(),
  ],
});

// =============================================================================
// AUTH TYPE EXPORTS
// =============================================================================
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
