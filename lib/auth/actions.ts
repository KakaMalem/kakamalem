"use server";

import { auth } from "./index";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { loginSchema, signupSchema } from "@/lib/validations/auth";
import { ZodError } from "zod";

// =============================================================================
// BETTER AUTH SERVER ACTIONS
// =============================================================================
// Replaces lib/supabase/auth.ts
// These actions handle email/password authentication
// =============================================================================

export type AuthError = {
  message: string;
  code?: string;
};

export type AuthResult = {
  error?: AuthError;
  success?: boolean;
  requiresEmailVerification?: boolean;
};

/**
 * Sign up with email and password
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const formValues = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  // Server-side validation
  try {
    signupSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
        },
      };
    }
  }

  try {
    const response = await auth.api.signUpEmail({
      body: {
        name: formValues.fullName,
        email: formValues.email,
        password: formValues.password,
      },
      headers: await headers(),
    });

    if (!response) {
      return {
        error: { message: "Failed to create account" },
      };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      requiresEmailVerification: true,
    };
  } catch (error) {
    console.error("Sign up error:", error);

    // Handle specific Better Auth errors
    if (error instanceof Error) {
      if (
        error.message.includes("already exists") ||
        error.message.includes("already registered")
      ) {
        return {
          error: { message: "An account with this email already exists" },
        };
      }
      return {
        error: { message: error.message },
      };
    }

    return {
      error: { message: "An unexpected error occurred" },
    };
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const formValues = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Server-side validation
  try {
    loginSchema.parse(formValues);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstError = err.issues[0];
      return {
        error: {
          message: firstError?.message || "Validation failed",
        },
      };
    }
  }

  try {
    const response = await auth.api.signInEmail({
      body: {
        email: formValues.email,
        password: formValues.password,
      },
      headers: await headers(),
    });

    if (!response) {
      return {
        error: { message: "Invalid email or password" },
      };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Sign in error:", error);

    // Handle specific Better Auth errors
    if (error instanceof Error) {
      if (
        error.message.includes("Invalid") ||
        error.message.includes("credentials")
      ) {
        return {
          error: { message: "Invalid email or password" },
        };
      }
      if (
        error.message.includes("verified") ||
        error.message.includes("verification")
      ) {
        return {
          error: { message: "Please verify your email before signing in" },
        };
      }
      return {
        error: { message: error.message },
      };
    }

    return {
      error: { message: "An unexpected error occurred" },
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    return {
      error: {
        message: error instanceof Error ? error.message : "Failed to sign out",
      },
    };
  }
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    await auth.api.requestPasswordReset({
      body: { email },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    // Don't reveal if email exists or not for security
    return { success: true };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    await auth.api.resetPassword({
      body: {
        token,
        newPassword,
      },
      headers: await headers(),
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      error: {
        message:
          error instanceof Error ? error.message : "Failed to reset password",
      },
    };
  }
}
