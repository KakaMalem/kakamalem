import { z } from "zod";

// Global user notification preferences
export const updateGlobalPreferencesSchema = z.object({
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  timezone: z.string().max(50).optional(),
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});

// Per-event channel preferences
const eventChannelSchema = z.object({
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
});

// Per-store notification preferences
export const updateStorePreferencesSchema = z.object({
  tenantId: z.string().uuid(),
  notificationsEnabled: z.boolean(),
  eventPreferences: z.record(z.string(), eventChannelSchema).optional(),
});

// Device removal
export const removeDeviceSchema = z.object({
  endpoint: z.string().min(1),
});

export type UpdateGlobalPreferencesInput = z.infer<
  typeof updateGlobalPreferencesSchema
>;
export type UpdateStorePreferencesInput = z.infer<
  typeof updateStorePreferencesSchema
>;
export type RemoveDeviceInput = z.infer<typeof removeDeviceSchema>;
