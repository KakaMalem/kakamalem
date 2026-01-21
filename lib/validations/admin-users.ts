import { z } from "zod";

// =============================================================================
// ADMIN USER VALIDATION SCHEMAS
// =============================================================================

export const platformRoles = ["user", "platform_admin", "super_admin"] as const;

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(platformRoles, {
    message: "Invalid platform role",
  }),
});

export const softDeleteUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  reason: z.string().max(1000).optional(),
});

export const userAdminNoteSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  note: z
    .string()
    .min(1, "Note is required")
    .max(2000, "Note must be less than 2000 characters"),
});

// Types
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type SoftDeleteUserInput = z.infer<typeof softDeleteUserSchema>;
export type UserAdminNoteInput = z.infer<typeof userAdminNoteSchema>;
