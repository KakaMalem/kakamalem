/**
 * USDT Crypto Payment Types
 *
 * Self-hosted USDT wallet payment system with manual verification.
 * Supports TRC20 (Tron), ERC20 (Ethereum), and BEP20 (BSC) networks.
 */

import type { CryptoNetwork, UsdtWalletConfig } from "@/lib/db/schema";

// =============================================================================
// CRYPTO PAYMENT SESSION
// =============================================================================

export type CryptoPaymentSession = {
  /** Selected network (trc20, erc20, bep20) */
  network: CryptoNetwork;
  /** Wallet address for this network */
  walletAddress: string;
  /** Expected USDT amount */
  expectedAmount: number;
  /** Currency code (always USDT) */
  currency: string;
  /** Session expiration timestamp */
  expiresAt: string;
  /** Data for QR code generation (USDT transfer URI) */
  qrCodeData: string;
  /** Exchange rate at time of session creation */
  exchangeRate: number;
  /** Original amount in AFN */
  originalAmountAfn: number;
};

// =============================================================================
// CRYPTO VERIFICATION
// =============================================================================

export type CryptoVerificationResult = {
  /** Whether the payment is verified */
  verified: boolean;
  /** Status of the crypto payment */
  status: "pending" | "submitted" | "verified" | "expired" | "rejected";
  /** Transaction hash if submitted */
  transactionHash?: string;
  /** Verified amount in USDT */
  amount?: number;
  /** Error message if verification failed */
  error?: string;
};

// =============================================================================
// QR CODE GENERATION
// =============================================================================

/**
 * Generate QR code data for USDT transfer
 *
 * Uses different URI formats for different networks:
 * - TRC20: tron:{address}?amount={amount}
 * - ERC20: ethereum:{address}?value={amount}
 * - BEP20: bnb:{address}?amount={amount}
 *
 * Note: Most wallets don't support standardized USDT transfer URIs,
 * so we use simple address:amount format that's easily scannable
 */
export function generateQrCodeData(
  _network: CryptoNetwork,
  address: string,
  _amount: number
): string {
  // Simple format that works with most QR readers
  // User will need to manually enter amount
  return address;
}

// =============================================================================
// WALLET ADDRESS VALIDATION
// =============================================================================

/**
 * Validate wallet address format for each network
 */
export function validateWalletAddress(
  address: string,
  network: CryptoNetwork
): boolean {
  if (!address || typeof address !== "string") return false;

  switch (network) {
    case "trc20":
      // TRC20 addresses start with T and are 34 chars
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);

    case "erc20":
      // ERC20 addresses start with 0x and are 42 chars
      return /^0x[a-fA-F0-9]{40}$/.test(address);

    case "bep20":
      // BEP20 addresses are same format as ERC20
      return /^0x[a-fA-F0-9]{40}$/.test(address);

    default:
      return false;
  }
}

/**
 * Validate transaction hash format for each network
 */
export function validateTransactionHash(
  hash: string,
  network: CryptoNetwork
): boolean {
  if (!hash || typeof hash !== "string") return false;

  switch (network) {
    case "trc20":
      // Tron transaction hashes are 64 hex chars
      return /^[a-fA-F0-9]{64}$/.test(hash);

    case "erc20":
    case "bep20":
      // Ethereum/BSC transaction hashes start with 0x and are 66 chars
      return /^0x[a-fA-F0-9]{64}$/.test(hash);

    default:
      return false;
  }
}

// =============================================================================
// NETWORK INFO
// =============================================================================

export type NetworkInfo = {
  name: string;
  fullName: string;
  symbol: string;
  explorerUrl: string;
  avgConfirmationTime: string;
  avgFee: string;
};

export const NETWORK_INFO: Record<CryptoNetwork, NetworkInfo> = {
  trc20: {
    name: "TRC20",
    fullName: "Tron Network",
    symbol: "TRX",
    explorerUrl: "https://tronscan.org/#/transaction/",
    avgConfirmationTime: "~3 minutes",
    avgFee: "~1 USDT",
  },
  erc20: {
    name: "ERC20",
    fullName: "Ethereum Network",
    symbol: "ETH",
    explorerUrl: "https://etherscan.io/tx/",
    avgConfirmationTime: "~5 minutes",
    avgFee: "~5-20 USDT",
  },
  bep20: {
    name: "BEP20",
    fullName: "BNB Smart Chain",
    symbol: "BNB",
    explorerUrl: "https://bscscan.com/tx/",
    avgConfirmationTime: "~3 minutes",
    avgFee: "~0.50 USDT",
  },
};

/**
 * Get explorer URL for a transaction
 */
export function getTransactionExplorerUrl(
  hash: string,
  network: CryptoNetwork
): string {
  const info = NETWORK_INFO[network];
  return `${info.explorerUrl}${hash}`;
}

// =============================================================================
// CREDENTIAL HELPERS
// =============================================================================

/**
 * Get enabled wallet from config for a network
 */
export function getWalletForNetwork(
  config: UsdtWalletConfig | null | undefined,
  network: CryptoNetwork
): { address: string; enabled: boolean } | null {
  if (!config) return null;

  const wallet = config[network];
  if (!wallet?.enabled || !wallet.address) return null;

  return wallet;
}

/**
 * Get all enabled networks from config
 */
export function getEnabledNetworks(
  config: UsdtWalletConfig | null | undefined
): CryptoNetwork[] {
  if (!config) return [];

  const networks: CryptoNetwork[] = [];

  if (config.trc20?.enabled && config.trc20.address) {
    networks.push("trc20");
  }
  if (config.erc20?.enabled && config.erc20.address) {
    networks.push("erc20");
  }
  if (config.bep20?.enabled && config.bep20.address) {
    networks.push("bep20");
  }

  return networks;
}

// =============================================================================
// EXCHANGE RATE HELPERS
// =============================================================================

/**
 * Default AFN to USDT exchange rate (placeholder - should be fetched from API)
 * At time of writing: 1 USD ≈ 70 AFN, so 1 USDT ≈ 70 AFN
 */
export const DEFAULT_AFN_TO_USDT_RATE = 70;

/**
 * Convert AFN amount to USDT
 */
export function convertAfnToUsdt(
  afnAmount: number,
  exchangeRate: number = DEFAULT_AFN_TO_USDT_RATE
): number {
  if (exchangeRate <= 0) {
    exchangeRate = DEFAULT_AFN_TO_USDT_RATE;
  }
  return Number((afnAmount / exchangeRate).toFixed(2));
}
