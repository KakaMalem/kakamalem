import {
  banner,
  bulletList,
  callout,
  contactFooter,
  emailShell,
  heading,
  paragraph,
  escapeHtml,
} from "../styles";

interface StoreSuspendedEmailParams {
  ownerName: string;
  storeName: string;
  reason?: string;
  supportEmail: string;
  baseUrl: string;
}

export function getStoreSuspendedEmailHtml(
  params: StoreSuspendedEmailParams
): string {
  const reasonBlock = params.reason?.trim()
    ? callout({
        label: "Reason",
        text: params.reason.trim(),
        kind: "warning",
      })
    : "";

  const body = `
    ${banner({ kind: "danger", text: "Store suspended" })}
    ${heading("Your store has been suspended")}
    ${paragraph(`Hi ${escapeHtml(params.ownerName)},`)}
    ${paragraph(`Your store <strong>${escapeHtml(params.storeName)}</strong> has been suspended by the Kaka Malem team.`)}
    ${reasonBlock}
    ${paragraph("While the store is suspended:")}
    ${bulletList([
      { kind: "negative", text: "Customers cannot access your storefront" },
      { kind: "negative", text: "New orders cannot be placed" },
      {
        kind: "positive",
        text: "Your products, orders, and customer data stay safe",
      },
      { kind: "positive", text: "You can still sign in to your dashboard" },
    ])}
    ${paragraph(`If you believe this is a mistake or would like to resolve the issue, reply to this email or reach us at <a href="mailto:${escapeHtml(params.supportEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(params.supportEmail)}</a>. We'll get back to you as soon as possible.`)}
    ${contactFooter(params.supportEmail)}
  `;

  return emailShell({
    title: `Store suspended — ${params.storeName}`,
    preheader: `Your store ${params.storeName} has been suspended by the Kaka Malem team`,
    body,
  });
}
