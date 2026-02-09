/**
 * TronGrid API Client
 *
 * Monitors TRC20 USDT transactions for automatic payment detection.
 * Uses the official Tron API (free, unlimited for basic queries).
 *
 * @see https://developers.tron.network/reference/trongrid-api
 */

// USDT TRC20 Contract Address on Tron Mainnet
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// TronGrid API endpoints
const TRONGRID_API = "https://api.trongrid.io";

// Types
export type TRC20Transfer = {
  transaction_id: string;
  from: string;
  to: string;
  value: string; // In smallest unit (6 decimals for USDT)
  block_timestamp: number;
  confirmed: boolean;
};

export type TransactionCheckResult = {
  found: boolean;
  transaction?: {
    hash: string;
    from: string;
    amount: number; // In USDT
    timestamp: Date;
    confirmed: boolean;
  };
  error?: string;
};

/**
 * Convert USDT amount from smallest unit to decimal
 * USDT has 6 decimal places on Tron
 */
function fromSunToUsdt(sun: string): number {
  return parseInt(sun, 10) / 1_000_000;
}

/**
 * Check for incoming USDT transfers to a wallet address
 *
 * @param walletAddress - The TRC20 wallet address to check
 * @param expectedAmount - Expected USDT amount (with decimals)
 * @param sinceTimestamp - Only check transactions after this time
 * @param tolerance - Amount tolerance for matching (default 0.01 USDT)
 */
export async function checkForIncomingPayment(
  walletAddress: string,
  expectedAmount: number,
  sinceTimestamp: Date,
  tolerance: number = 0.01
): Promise<TransactionCheckResult> {
  try {
    // TronGrid API to get TRC20 transfers to an address
    const url = new URL(
      `${TRONGRID_API}/v1/accounts/${walletAddress}/transactions/trc20`
    );
    url.searchParams.set("only_to", "true"); // Only incoming transfers
    url.searchParams.set("only_confirmed", "false"); // Include unconfirmed for faster detection
    url.searchParams.set("limit", "50"); // Recent transactions
    url.searchParams.set("contract_address", USDT_CONTRACT); // Only USDT
    url.searchParams.set("min_timestamp", sinceTimestamp.getTime().toString());

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      // Cache for 10 seconds to avoid hammering the API
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      console.error(
        "[TronGrid] API error:",
        response.status,
        await response.text()
      );
      return { found: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const transfers: TRC20Transfer[] = data.data || [];

    // Find a transfer matching our expected amount
    for (const transfer of transfers) {
      const amount = fromSunToUsdt(transfer.value);

      // Check if amount matches within tolerance
      if (Math.abs(amount - expectedAmount) <= tolerance) {
        return {
          found: true,
          transaction: {
            hash: transfer.transaction_id,
            from: transfer.from,
            amount,
            timestamp: new Date(transfer.block_timestamp),
            confirmed: transfer.confirmed,
          },
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error("[TronGrid] Error checking for payment:", error);
    return {
      found: false,
      error:
        error instanceof Error ? error.message : "Failed to check blockchain",
    };
  }
}

/**
 * Verify a specific transaction hash
 *
 * @param txHash - Transaction hash to verify
 * @param expectedAddress - Expected recipient address
 * @param expectedAmount - Expected USDT amount
 */
export async function verifyTransaction(
  txHash: string,
  expectedAddress: string,
  expectedAmount: number,
  tolerance: number = 0.01
): Promise<{
  valid: boolean;
  confirmed: boolean;
  actualAmount?: number;
  error?: string;
}> {
  try {
    // Get transaction info
    const url = `${TRONGRID_API}/v1/transactions/${txHash}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return { valid: false, confirmed: false, error: "Transaction not found" };
    }

    const data = await response.json();

    // For TRC20, we need to check the internal transactions
    // Get TRC20 transfer events for this transaction
    const eventsUrl = `${TRONGRID_API}/v1/transactions/${txHash}/events`;
    const eventsResponse = await fetch(eventsUrl);

    if (!eventsResponse.ok) {
      return {
        valid: false,
        confirmed: false,
        error: "Could not fetch transaction events",
      };
    }

    const eventsData = await eventsResponse.json();
    const events = eventsData.data || [];

    // Find USDT transfer event
    for (const event of events) {
      if (
        event.contract_address === USDT_CONTRACT &&
        event.event_name === "Transfer"
      ) {
        const toAddress = event.result?.to || event.result?._to;
        const value = event.result?.value || event.result?._value;

        if (toAddress && value) {
          // Convert address format (TronGrid returns hex, we need base58)
          const amount = fromSunToUsdt(value);

          // Check if this is to our address and correct amount
          // Note: Address comparison may need normalization
          if (Math.abs(amount - expectedAmount) <= tolerance) {
            return {
              valid: true,
              confirmed: data.confirmed || false,
              actualAmount: amount,
            };
          }
        }
      }
    }

    return {
      valid: false,
      confirmed: false,
      error: "No matching transfer found",
    };
  } catch (error) {
    console.error("[TronGrid] Error verifying transaction:", error);
    return {
      valid: false,
      confirmed: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Generate a unique payment amount by adding random cents
 * This helps avoid collisions when multiple payments happen simultaneously
 *
 * @param baseAmount - Base USDT amount
 * @returns Unique amount with random cents added (0.01 - 0.99)
 */
export function generateUniqueAmount(baseAmount: number): number {
  // Add random cents between 0.01 and 0.99
  const randomCents = Math.floor(Math.random() * 99) + 1;
  return baseAmount + randomCents / 100;
}
