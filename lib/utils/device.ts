/**
 * Parse a user-agent string into a human-readable device name.
 * Returns e.g. "Chrome on Windows", "Safari on iPhone", "Firefox on Linux"
 */
export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  // Detect OS
  let os = "Unknown";
  if (userAgent.includes("iPhone")) os = "iPhone";
  else if (userAgent.includes("iPad")) os = "iPad";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("CrOS")) os = "ChromeOS";
  else if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "Mac";
  else if (userAgent.includes("Linux")) os = "Linux";

  // Detect browser
  let browser = "";
  if (userAgent.includes("Edg/")) browser = "Edge";
  else if (userAgent.includes("OPR/") || userAgent.includes("Opera"))
    browser = "Opera";
  else if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/"))
    browser = "Chrome";
  else if (userAgent.includes("Firefox/")) browser = "Firefox";
  else if (
    userAgent.includes("Safari/") &&
    !userAgent.includes("Chrome") &&
    !userAgent.includes("Edg/")
  )
    browser = "Safari";

  return browser ? `${browser} on ${os}` : os;
}

/**
 * Get an icon hint for a device based on its parsed name.
 * Returns "smartphone" | "tablet" | "desktop"
 */
export function getDeviceType(
  deviceName: string
): "smartphone" | "tablet" | "desktop" {
  const lower = deviceName.toLowerCase();
  if (
    lower.includes("iphone") ||
    lower.includes("android") ||
    lower.includes("mobile")
  )
    return "smartphone";
  if (lower.includes("ipad") || lower.includes("tablet")) return "tablet";
  return "desktop";
}
