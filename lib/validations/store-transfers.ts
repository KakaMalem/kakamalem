import { z } from "zod";

// Initiate transfer validation
export const initiateTransferSchema = z.object({
  newOwnerEmail: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  message: z
    .string()
    .max(500, "Message must be less than 500 characters")
    .optional(),
  confirmStoreName: z.string().min(1, "Please type the store name to confirm"),
});

export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;

// Response to transfer validation
export const respondToTransferSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  action: z.enum(["accept", "reject"]),
});

export type RespondToTransferInput = z.infer<typeof respondToTransferSchema>;
