"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getUserProfile } from "@/lib/auth/server";
import {
  updatePhoneSchema,
  type UpdatePhoneInput,
} from "@/lib/validations/profile";

export type ProfileActionResult = {
  success?: boolean;
  error?: { message: string; field?: string };
};

/**
 * Update user's phone number
 * Used during onboarding wizard and account settings
 */
export async function updatePhoneAction(
  input: UpdatePhoneInput
): Promise<ProfileActionResult> {
  // Validate input
  const validation = updatePhoneSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0].message,
        field: "phone",
      },
    };
  }

  // Require authentication
  const user = await requireAuth();

  // Get existing profile
  const profile = await getUserProfile();
  if (!profile) {
    return { error: { message: "Profile not found" } };
  }

  // Update phone
  await db
    .update(userProfiles)
    .set({
      phone: validation.data.phone,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userProfiles.userId, user.id));

  // Revalidate dashboard to reflect changes
  revalidatePath("/dashboard");

  return { success: true };
}
