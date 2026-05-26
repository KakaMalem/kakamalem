import {
  banner,
  bulletList,
  button,
  buttonRow,
  contactFooter,
  emailShell,
  heading,
  paragraph,
  escapeHtml,
} from "../styles";

interface SubscriptionExpiredEmailParams {
  ownerName: string;
  storeName: string;
  storeSlug: string;
  expiredDate: string;
  baseUrl: string;
  supportEmail?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getSubscriptionExpiredEmailHtml(
  params: SubscriptionExpiredEmailParams
): string {
  const reactivateUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing/upgrade`;
  const supportEmail = params.supportEmail || "support@kakamalem.com";

  const body = `
    ${banner({ kind: "danger", text: "Subscription expired", icon: "&#10007;" })}
    ${heading("Your Pro subscription has expired")}
    ${paragraph(`Hi ${escapeHtml(params.ownerName)},`)}
    ${paragraph(`Your <strong>Kaka Malem Pro</strong> subscription for <strong>${escapeHtml(params.storeName)}</strong> expired on <strong>${formatDate(params.expiredDate)}</strong>. Your store has been moved to the Free plan.`)}
    ${bulletList([
      { kind: "negative", text: "Product limit reduced to 20 products" },
      { kind: "negative", text: "Advanced analytics disabled" },
      { kind: "negative", text: "Priority support no longer available" },
      {
        kind: "positive",
        text: "Your data and existing products are safe",
      },
      { kind: "positive", text: "Your store stays online for customers" },
    ])}
    ${paragraph(`You can reactivate Pro anytime to restore unlimited products and all premium features.`)}
    ${buttonRow(button({ href: reactivateUrl, label: "Reactivate Pro" }))}
    ${contactFooter(supportEmail)}
  `;

  return emailShell({
    title: "Subscription expired",
    preheader: `Your Pro subscription expired on ${formatDate(params.expiredDate)}`,
    body,
  });
}
