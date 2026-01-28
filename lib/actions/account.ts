"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";

// =============================================================================
// ACCOUNT SETTINGS SERVER ACTIONS
// =============================================================================

export const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const setPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type UpdateNameInput = z.infer<typeof updateNameSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

/**
 * Update user's display name
 */
export async function updateNameAction(input: UpdateNameInput) {
  const validation = updateNameSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: "Invalid name",
        issues: validation.error.issues,
      },
    };
  }

  try {
    const headersList = await headers();
    const result = await auth.api.updateUser({
      headers: headersList,
      body: {
        name: validation.data.name,
      },
    });

    if (!result) {
      return { error: { message: "Failed to update name" } };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update name:", error);
    return { error: { message: "Failed to update name" } };
  }
}

/**
 * Change user's password
 */
export async function changePasswordAction(input: ChangePasswordInput) {
  const validation = changePasswordSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0].message,
        issues: validation.error.issues,
      },
    };
  }

  try {
    const headersList = await headers();
    const result = await auth.api.changePassword({
      headers: headersList,
      body: {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
      },
    });

    if (!result) {
      return { error: { message: "Failed to change password" } };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to change password:", error);
    // Better Auth throws specific errors for wrong password
    if (error instanceof Error && error.message.includes("Invalid")) {
      return { error: { message: "Current password is incorrect" } };
    }
    return { error: { message: "Failed to change password" } };
  }
}

/**
 * Set password for OAuth-only users (no current password required)
 */
export async function setPasswordAction(input: SetPasswordInput) {
  const validation = setPasswordSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0].message,
        issues: validation.error.issues,
      },
    };
  }

  try {
    const headersList = await headers();
    const result = await auth.api.setPassword({
      headers: headersList,
      body: {
        newPassword: validation.data.newPassword,
      },
    });

    if (!result) {
      return { error: { message: "Failed to set password" } };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to set password:", error);
    return { error: { message: "Failed to set password" } };
  }
}

/**
 * Request email change (sends verification to new email)
 */
export async function requestEmailChangeAction(newEmail: string) {
  const emailSchema = z.string().email("Invalid email address");
  const validation = emailSchema.safeParse(newEmail);

  if (!validation.success) {
    return { error: { message: "Invalid email address" } };
  }

  try {
    const headersList = await headers();
    const result = await auth.api.changeEmail({
      headers: headersList,
      body: {
        newEmail: validation.data,
      },
    });

    if (!result) {
      return { error: { message: "Failed to initiate email change" } };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to change email:", error);
    return { error: { message: "Failed to initiate email change" } };
  }
}

/**
 * Delete user account (requires confirmation)
 */
export async function deleteAccountAction(password?: string) {
  try {
    const headersList = await headers();
    const result = await auth.api.deleteUser({
      headers: headersList,
      body: {
        password: password,
      },
    });

    if (!result) {
      return { error: { message: "Failed to delete account" } };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete account:", error);
    return { error: { message: "Failed to delete account" } };
  }
}
