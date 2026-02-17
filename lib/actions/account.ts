"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  updateNameSchema,
  changePasswordSchema,
  setPasswordSchema,
  type UpdateNameInput,
  type ChangePasswordInput,
  type SetPasswordInput,
} from "@/lib/validations/account";

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
 *
 * Better Auth's setPassword endpoint is defined without a path, causing issues.
 * We implement this directly by:
 * 1. Getting the current user session
 * 2. Checking they don't already have a credential account
 * 3. Hashing the password using Better Auth's password hasher
 * 4. Creating a credential account linked to the user
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

    // Get current session
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user?.id) {
      return { error: { message: "You must be logged in to set a password" } };
    }

    const userId = session.user.id;

    // Check if user already has a credential account (password)
    const existingCredentialAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, userId),
        eq(account.providerId, "credential")
      ),
    });

    if (existingCredentialAccount) {
      return {
        error: { message: "You already have a password set" },
      };
    }

    // Hash the password using Better Auth's password hasher
    const { hashPassword } = await import("better-auth/crypto");
    const hashedPassword = await hashPassword(validation.data.newPassword);

    // Create credential account for the user
    await db.insert(account).values({
      id: nanoid(),
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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
