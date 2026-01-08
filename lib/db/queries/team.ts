"use server";

import { db } from "@/lib/db";
import { tenantMembers, user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type TeamMemberWithProfile = {
  id: string;
  userId: string;
  role: "owner" | "admin" | "staff";
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

/**
 * Get all team members for a tenant with their profile info
 */
export async function getTeamMembers(
  tenantId: string
): Promise<TeamMemberWithProfile[]> {
  const members = await db
    .select({
      id: tenantMembers.id,
      userId: tenantMembers.userId,
      role: tenantMembers.role,
      createdAt: tenantMembers.createdAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.name,
        avatarUrl: user.image,
      },
    })
    .from(tenantMembers)
    .innerJoin(user, eq(tenantMembers.userId, user.id))
    .where(eq(tenantMembers.tenantId, tenantId))
    .orderBy(tenantMembers.createdAt);

  return members;
}

/**
 * Update a team member's role
 */
export async function updateTeamMemberRole(
  tenantId: string,
  memberId: string,
  role: "admin" | "staff"
) {
  const [updated] = await db
    .update(tenantMembers)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(
      and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId))
    )
    .returning();

  return updated;
}

/**
 * Remove a team member
 */
export async function removeTeamMember(tenantId: string, memberId: string) {
  await db
    .delete(tenantMembers)
    .where(
      and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId))
    );
}

/**
 * Add a team member by user ID
 */
export async function addTeamMember(
  tenantId: string,
  userId: string,
  role: "admin" | "staff" = "staff"
) {
  const [member] = await db
    .insert(tenantMembers)
    .values({
      tenantId,
      userId,
      role,
    })
    .returning();

  return member;
}

/**
 * Check if a user is already a member of a tenant
 */
export async function isUserMember(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const existing = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, userId)
    ),
  });

  return !!existing;
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email: string) {
  const foundUser = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  if (!foundUser) return null;

  // Return in expected format for compatibility
  return {
    id: foundUser.id,
    email: foundUser.email,
    fullName: foundUser.name,
    avatarUrl: foundUser.image,
  };
}
