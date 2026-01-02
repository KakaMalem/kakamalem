"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import { getTenantById } from "@/lib/db/queries/tenants";
import {
  updateTeamMemberRole,
  removeTeamMember,
  addTeamMember,
  isUserMember,
  findUserByEmail,
  getTeamMembers,
} from "@/lib/db/queries/team";

type ActionResult = {
  success: boolean;
  error?: {
    message: string;
    field?: string;
  };
};

/**
 * Update a team member's role
 */
export async function updateMemberRole(
  storeId: string,
  memberId: string,
  role: "admin" | "staff"
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      success: false,
      error: { message: "You don't have permission to manage team members" },
    };
  }

  // Get the member to check if it's not the owner
  const members = await getTeamMembers(storeId);
  const member = members.find((m) => m.id === memberId);

  if (!member) {
    return { success: false, error: { message: "Team member not found" } };
  }

  if (member.role === "owner") {
    return {
      success: false,
      error: { message: "Cannot change the owner's role" },
    };
  }

  try {
    await updateTeamMemberRole(storeId, memberId, role);
    revalidatePath("/dashboard/settings/team", "page");
    return { success: true };
  } catch {
    return {
      success: false,
      error: { message: "Failed to update role. Please try again." },
    };
  }
}

/**
 * Remove a team member from the store
 */
export async function removeMember(
  storeId: string,
  memberId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      success: false,
      error: { message: "You don't have permission to remove team members" },
    };
  }

  // Get the member to check if it's not the owner
  const members = await getTeamMembers(storeId);
  const member = members.find((m) => m.id === memberId);

  if (!member) {
    return { success: false, error: { message: "Team member not found" } };
  }

  if (member.role === "owner") {
    return {
      success: false,
      error: { message: "Cannot remove the store owner" },
    };
  }

  try {
    await removeTeamMember(storeId, memberId);
    revalidatePath("/dashboard/settings/team", "page");
    return { success: true };
  } catch {
    return {
      success: false,
      error: { message: "Failed to remove member. Please try again." },
    };
  }
}

/**
 * Invite a team member by email
 */
export async function inviteMember(
  storeId: string,
  email: string,
  role: "admin" | "staff"
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: { message: "You must be logged in" } };
  }

  const store = await getTenantById(storeId);
  if (!store || store.ownerId !== user.id) {
    return {
      success: false,
      error: { message: "You don't have permission to invite team members" },
    };
  }

  // Find user by email
  const invitedUser = await findUserByEmail(email.toLowerCase());

  if (!invitedUser) {
    return {
      success: false,
      error: {
        message:
          "No user found with this email. They need to create an account first.",
        field: "email",
      },
    };
  }

  // Check if user is already a member
  const alreadyMember = await isUserMember(storeId, invitedUser.id);
  if (alreadyMember) {
    return {
      success: false,
      error: {
        message: "This user is already a team member",
        field: "email",
      },
    };
  }

  // Can't invite yourself
  if (invitedUser.id === user.id) {
    return {
      success: false,
      error: {
        message: "You can't invite yourself",
        field: "email",
      },
    };
  }

  try {
    await addTeamMember(storeId, invitedUser.id, role);
    revalidatePath("/dashboard/settings/team", "page");
    return { success: true };
  } catch {
    return {
      success: false,
      error: { message: "Failed to add team member. Please try again." },
    };
  }
}
