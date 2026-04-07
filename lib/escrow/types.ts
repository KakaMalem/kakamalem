import type {
  EscrowStatus,
  EscrowCurrency,
  DisputeStatus,
  DisputeParty,
  CryptoNetwork,
} from "@/lib/db/schema";

export type { EscrowStatus, EscrowCurrency, DisputeStatus, DisputeParty };

/** Default auto-release timeout in days after marking as shipped */
export const AUTO_RELEASE_DAYS = 30;

/** Result type for escrow operations */
export type EscrowResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Input for creating an escrow transaction */
export type CreateEscrowInput = {
  orderId: string;
  tenantId: string;
  buyerId: string;
  sellerId: string;
  amount: string; // decimal string
  currency: EscrowCurrency;
  network: CryptoNetwork;
  walletAddress: string;
  platformFeePercent?: string; // defaults to platform setting
};

/** Input for funding an escrow (buyer payment confirmed) */
export type FundEscrowInput = {
  escrowId: string;
  txHash: string;
};

/** Input for marking shipment */
export type ShipEscrowInput = {
  escrowId: string;
  trackingNumber: string;
  trackingCarrier?: string;
};

/** Input for opening a dispute */
export type OpenDisputeInput = {
  escrowId: string;
  openedBy: string; // user ID
  openedByRole: DisputeParty;
  reason: string;
  description?: string;
  evidenceUrls?: string[];
};

/** Input for resolving a dispute */
export type ResolveDisputeInput = {
  disputeId: string;
  resolvedBy: string; // admin user ID
  resolution: "buyer" | "seller";
  resolutionNote: string;
};
