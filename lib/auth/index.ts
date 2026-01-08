import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// =============================================================================
// BETTER AUTH CONFIGURATION
// =============================================================================
// Replaces Supabase Auth with self-hosted authentication
// Universal identity system for all portals (seller, affiliate, delivery)
// =============================================================================

export const auth = betterAuth({
  // Secret for signing tokens/cookies (REQUIRED)
  secret: process.env.BETTER_AUTH_SECRET,

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
    // Disabled in development since email isn't configured
    requireEmailVerification: process.env.NODE_ENV === "production",
    // Password requirements
    minPasswordLength: 8,
    // Auto sign in after registration (enabled in dev for faster testing)
    autoSignIn: process.env.NODE_ENV !== "production",
  },

  // ==========================================================================
  // SOCIAL OAUTH PROVIDERS
  // ==========================================================================
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // Facebook OAuth (common in Afghanistan market)
    // facebook: {
    //   clientId: process.env.FACEBOOK_CLIENT_ID!,
    //   clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    // },
  },

  // ==========================================================================
  // SESSION CONFIGURATION
  // ==========================================================================
  session: {
    // Session expires after 30 days of inactivity
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    // Update session expiry on each request
    updateAge: 60 * 60 * 24, // Update every 24 hours
    // Cookie configuration
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
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
  // Email verification only runs in production
  ...(process.env.NODE_ENV === "production" && {
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string | null }; url: string }) => {
        // TODO: Implement email sending with Resend
        console.log(`Verification email for ${user.email}: ${url}`);
        await sendEmail({
          to: user.email,
          subject: "Verify your Kaka Malem account",
          template: "email-verification",
          data: { url, name: user.name },
        });
      },
    },
  }),

  // Password reset emails
  // This is configured in the emailAndPassword section callbacks

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
  // ADVANCED OPTIONS
  // ==========================================================================
  advanced: {
    // Use secure cookies only when serving over HTTPS
    // Check if APP_URL starts with https:// to determine if we need secure cookies
    useSecureCookies: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
    // Cookie prefix
    cookiePrefix: "kaka_malem",
    // Cross-site cookie settings
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // ==========================================================================
  // CALLBACKS & HOOKS
  // ==========================================================================
  // These run after authentication events
  // Use to create related records (userProfiles, etc.)
});

// =============================================================================
// HELPER: EMAIL SENDING FUNCTION
// =============================================================================
// Placeholder - implement with your email provider
async function sendEmail({
  to,
  subject,
  template,
  data,
}: {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}) {
  // TODO: Implement with Nodemailer
  // Example with Resend:
  //
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  //
  // await resend.emails.send({
  //   from: 'Kaka Malem <noreply@kakamalem.com>',
  //   to,
  //   subject,
  //   react: EmailTemplate({ ...data }),
  // });

  console.log(`[Email] To: ${to}, Subject: ${subject}, Template: ${template}`);
  console.log(`[Email] Data:`, data);
}

// =============================================================================
// AUTH TYPE EXPORTS
// =============================================================================
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
