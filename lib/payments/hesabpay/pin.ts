/**
 * Merchant PIN encryption for HesabPay payouts.
 *
 * Sending money out of a HesabPay account requires the merchant PIN, and
 * HesabPay expects it encrypted rather than in plaintext. The scheme is taken
 * from HesabPay's own WooCommerce plugin, which does:
 *
 *   $key = substr($api_key, 0, 32);
 *   $iv  = random_bytes(16);
 *   $ct  = openssl_encrypt($pin, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
 *   return base64_encode($iv . $ct);
 *
 * Two details matter for interoperability:
 *
 * - The key is the first 32 *bytes* of the API key. PHP zero-pads a key shorter
 *   than the cipher's key length, so we allocate a 32-byte zero buffer and copy
 *   into it rather than rejecting short keys.
 * - The IV is prepended to the ciphertext before base64, not sent separately.
 *
 * A fresh random IV per call means the same PIN never produces the same
 * ciphertext twice, so a captured request cannot be replayed.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY_BYTES = 32;
const IV_BYTES = 16;

/**
 * Derive the AES key from an API key: first 32 bytes, zero-padded if short.
 * Exported for tests; callers should use `encryptMerchantPin`.
 */
export function deriveKeyFromApiKey(apiKey: string): Buffer {
  const key = Buffer.alloc(KEY_BYTES);
  Buffer.from(apiKey, "utf8").subarray(0, KEY_BYTES).copy(key);
  return key;
}

/**
 * Encrypt a merchant PIN for a HesabPay send-money request.
 * Returns base64 of the IV followed by the ciphertext.
 */
export function encryptMerchantPin(pin: string, apiKey: string): string {
  if (!pin) throw new Error("Merchant PIN is required");
  if (!apiKey) throw new Error("API key is required to encrypt the PIN");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKeyFromApiKey(apiKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(pin, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, ciphertext]).toString("base64");
}

/**
 * Reverse of `encryptMerchantPin`. Not used against HesabPay, which never
 * sends an encrypted PIN back; it exists so the format can be verified.
 */
export function decryptMerchantPin(encrypted: string, apiKey: string): string {
  const raw = Buffer.from(encrypted, "base64");
  if (raw.length <= IV_BYTES) {
    throw new Error("Encrypted PIN is too short to contain an IV");
  }

  const iv = raw.subarray(0, IV_BYTES);
  const ciphertext = raw.subarray(IV_BYTES);
  const decipher = createDecipheriv(ALGORITHM, deriveKeyFromApiKey(apiKey), iv);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
