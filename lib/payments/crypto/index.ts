/**
 * USDT Crypto Payment Module
 *
 * Self-hosted USDT wallet payment system with manual verification.
 * Supports TRC20 (Tron), ERC20 (Ethereum), and BEP20 (BSC) networks.
 */

import { db } from "@/lib/db";
import type { UsdtWalletConfig } from "@/lib/db/schema";

export { cryptoUsdtClient, CryptoUsdtClient } from "./client";
export * from "./types";
export * from "./trongrid";

/**
 * Check if USDT crypto payments are configured and available at platform level
 * Returns true if at least one network has a wallet configured
 */
export async function isCryptoEnabled(): Promise<boolean> {
  try {
    const settings = await db.query.platformSettings.findFirst();
    const walletConfig = settings?.usdtWalletConfig as UsdtWalletConfig | null;

    if (!walletConfig) {
      return false;
    }

    // Check if at least one network is enabled with a valid address
    return !!(
      (walletConfig.trc20?.enabled && walletConfig.trc20.address) ||
      (walletConfig.erc20?.enabled && walletConfig.erc20.address) ||
      (walletConfig.bep20?.enabled && walletConfig.bep20.address)
    );
  } catch (error) {
    console.error("[Crypto] Failed to check crypto enabled status:", error);
    return false;
  }
}
