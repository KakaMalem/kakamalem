/**
 * Shared email design tokens and HTML builders.
 *
 * Email-safe rules followed here:
 * - Inline styles only (most clients strip <style>).
 * - System font stack — no @font-face.
 * - No flex / grid — table-based wrappers.
 * - Modern CSS (border-radius, gradient) is fine in Apple Mail, Gmail web,
 *   iOS Gmail. Outlook on Windows ignores some of it but degrades cleanly.
 */

export const emailTokens = {
  fontStack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,

  // Brand
  brandGradient: "linear-gradient(135deg, #2563eb 0%, #14b8a6 100%)",
  primary: "#2563eb", // blue-600
  primaryDark: "#1d4ed8",
  accent: "#14b8a6", // teal-500
  emerald: "#10b981",

  // Status palettes
  dangerText: "#991b1b",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  warningText: "#92400e",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  successText: "#166534",
  successBg: "#f0fdf4",
  successBorder: "#bbf7d0",
  infoText: "#1e40af",
  infoBg: "#eff6ff",
  infoBorder: "#bfdbfe",

  // Neutrals (zinc)
  text: "#18181b", // zinc-900
  textBody: "#3f3f46", // zinc-700
  textMuted: "#71717a", // zinc-500
  textSubtle: "#a1a1aa", // zinc-400
  border: "#e4e4e7", // zinc-200
  borderSubtle: "#f4f4f5", // zinc-100
  bgPage: "#fafafa", // zinc-50
  bgSubtle: "#fafafa",
  bgWhite: "#ffffff",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wraps body content in the standard branded shell (header + footer).
 * `preheader` is hidden but shown in the inbox preview line.
 */
export function emailShell(opts: {
  title: string;
  preheader: string;
  body: string;
}): string {
  const t = emailTokens;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(opts.title)}</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
  </style>
</head>
<body style="margin:0;padding:0;background:${t.bgPage};font-family:${t.fontStack};-webkit-font-smoothing:antialiased;color:${t.textBody};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${t.bgPage};">
    ${escapeHtml(opts.preheader)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${t.bgPage};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
          <tr>
            <td bgcolor="#000000" style="background:#000000;background-color:#000000;padding:30px;border-radius:10px 10px 0 0;text-align:center;">
              <h1 style="margin:0;padding:0;color:#ffffff;font-size:28px;font-weight:bold;font-family:${t.fontStack};line-height:1.2;"><font color="#ffffff" face="${t.fontStack}">Kaka Malem</font></h1>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:30px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;color:#333333;font-size:15px;line-height:1.6;font-family:${t.fontStack};">
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 16px 8px;color:${t.textSubtle};font-size:12px;line-height:1.5;font-family:${t.fontStack};">
              &copy; ${new Date().getFullYear()} Kaka Malem. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Page title block (large heading) used as the first element inside the body.
 */
export function heading(text: string): string {
  const t = emailTokens;
  return `<h1 style="margin:0 0 16px 0;color:${t.text};font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;font-family:${t.fontStack};">${escapeHtml(text)}</h1>`;
}

/**
 * Pill button — gradient by default, ghost-outline as secondary.
 */
export function button(opts: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}): string {
  const t = emailTokens;
  const variant = opts.variant || "primary";
  const baseStyle =
    "display:inline-block;padding:13px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;line-height:1;font-family:" +
    t.fontStack +
    ";";

  if (variant === "secondary") {
    return `<a href="${opts.href}" style="${baseStyle}background:${t.bgWhite};color:${t.text};border:1px solid ${t.border};">${escapeHtml(opts.label)}</a>`;
  }
  return `<a href="${opts.href}" style="${baseStyle}background:${t.brandGradient};color:#ffffff;">${escapeHtml(opts.label)}</a>`;
}

/**
 * Wraps a button (or pair of buttons) with consistent vertical rhythm.
 */
export function buttonRow(inner: string): string {
  return `<div style="text-align:center;margin:32px 0;">${inner}</div>`;
}

/**
 * Color-coded status banner shown near the top of the body.
 */
export function banner(opts: {
  kind: "danger" | "warning" | "success" | "info";
  text: string;
  icon?: string;
}): string {
  const t = emailTokens;
  const map = {
    danger: {
      bg: t.dangerBg,
      border: t.dangerBorder,
      color: t.dangerText,
      icon: "&#9888;",
    },
    warning: {
      bg: t.warningBg,
      border: t.warningBorder,
      color: t.warningText,
      icon: "&#9888;",
    },
    success: {
      bg: t.successBg,
      border: t.successBorder,
      color: t.successText,
      icon: "&#10003;",
    },
    info: {
      bg: t.infoBg,
      border: t.infoBorder,
      color: t.infoText,
      icon: "&#128276;",
    },
  } as const;
  const c = map[opts.kind];
  const icon = opts.icon || c.icon;
  return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:12px;margin:0 0 20px 0;text-align:center;">
    <span style="color:${c.color};font-weight:600;font-size:14px;font-family:${t.fontStack};">${icon} ${escapeHtml(opts.text)}</span>
  </div>`;
}

/**
 * Data table for invoice / subscription detail blocks.
 * Pass `total` to render an emphasized last row with a teal divider.
 */
export function infoTable(opts: {
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
  total?: { label: string; value: string };
}): string {
  const t = emailTokens;
  const rowsHtml = opts.rows
    .map(
      (row) => `
    <tr>
      <td style="padding:8px 0;color:${t.textMuted};font-size:14px;font-family:${t.fontStack};">${escapeHtml(row.label)}</td>
      <td style="padding:8px 0;text-align:right;font-weight:${row.emphasis ? "700" : "600"};font-size:14px;color:${t.text};font-family:${t.fontStack};">${escapeHtml(row.value)}</td>
    </tr>`
    )
    .join("");

  const totalHtml = opts.total
    ? `
    <tr>
      <td colspan="2" style="padding:12px 0 0 0;border-top:2px solid ${t.accent};"></td>
    </tr>
    <tr>
      <td style="padding:6px 0 0 0;color:${t.text};font-weight:700;font-size:16px;font-family:${t.fontStack};">${escapeHtml(opts.total.label)}</td>
      <td style="padding:6px 0 0 0;text-align:right;color:${t.primary};font-weight:700;font-size:16px;font-family:${t.fontStack};">${escapeHtml(opts.total.value)}</td>
    </tr>`
    : "";

  return `<div style="background:${t.bgSubtle};border:1px solid ${t.border};border-radius:12px;padding:18px 20px;margin:24px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tbody>${rowsHtml}${totalHtml}</tbody>
    </table>
  </div>`;
}

/**
 * Bullet-style "what this means" block — a list of pros/cons with icons.
 */
export function bulletList(
  items: Array<{ text: string; kind: "positive" | "negative" }>
): string {
  const t = emailTokens;
  const rows = items
    .map((item) => {
      const color = item.kind === "positive" ? "#16a34a" : "#dc2626";
      const icon = item.kind === "positive" ? "&#10003;" : "&#10007;";
      return `<tr>
        <td style="padding:8px 0;font-size:14px;color:${t.textBody};font-family:${t.fontStack};line-height:1.6;">
          <span style="color:${color};margin-right:10px;font-weight:700;">${icon}</span>
          ${escapeHtml(item.text)}
        </td>
      </tr>`;
    })
    .join("");
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/**
 * Paragraph helper — consistent body text size + spacing.
 */
export function paragraph(html: string, opts?: { muted?: boolean }): string {
  const t = emailTokens;
  const color = opts?.muted ? t.textMuted : t.textBody;
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:${color};font-family:${t.fontStack};">${html}</p>`;
}

/**
 * Final "contact us" footer note — separates from main content with a hairline.
 */
export function contactFooter(supportEmail: string): string {
  const t = emailTokens;
  const safe = escapeHtml(supportEmail);
  return `<hr style="border:none;border-top:1px solid ${t.borderSubtle};margin:32px 0 20px;">
  <p style="color:${t.textSubtle};font-size:12px;line-height:1.5;margin:0;font-family:${t.fontStack};">
    Questions? Reply to this email or contact us at <a href="mailto:${safe}" style="color:${t.primary};text-decoration:none;">${safe}</a>.
  </p>`;
}

/**
 * Highlighted callout block (e.g. for displaying a reason or a quote).
 */
export function callout(opts: {
  label: string;
  text: string;
  kind?: "warning" | "info";
}): string {
  const t = emailTokens;
  const palette =
    opts.kind === "warning"
      ? { bg: t.warningBg, border: t.warningBorder, label: t.warningText }
      : { bg: t.infoBg, border: t.infoBorder, label: t.infoText };
  return `<div style="background:${palette.bg};border:1px solid ${palette.border};border-radius:10px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:${palette.label};text-transform:uppercase;letter-spacing:0.06em;font-family:${t.fontStack};">${escapeHtml(opts.label)}</p>
    <p style="margin:0;color:${t.textBody};font-size:14px;line-height:1.55;white-space:pre-wrap;font-family:${t.fontStack};">${escapeHtml(opts.text)}</p>
  </div>`;
}

export { escapeHtml };
