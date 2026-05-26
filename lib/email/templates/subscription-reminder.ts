import {
  banner,
  button,
  buttonRow,
  contactFooter,
  emailShell,
  heading,
  infoTable,
  paragraph,
  emailTokens,
  escapeHtml,
} from "../styles";

interface SubscriptionReminderEmailParams {
  ownerName: string;
  storeName: string;
  storeSlug: string;
  daysUntilExpiry: number;
  expiryDate: string;
  planPrice: string;
  currency: string;
  billingInterval: string;
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

function pickUrgency(daysUntil: number) {
  if (daysUntil <= 1) {
    return {
      kind: "danger" as const,
      label: "Final Notice",
      heading: "Your Pro subscription expires tomorrow",
      preheader: `Renew today to avoid losing Pro access`,
    };
  }
  if (daysUntil <= 3) {
    return {
      kind: "warning" as const,
      label: "Expiring Soon",
      heading: `Your Pro subscription expires in ${daysUntil} days`,
      preheader: `Renew now to keep Pro features active`,
    };
  }
  return {
    kind: "info" as const,
    label: "Renewal Reminder",
    heading: `Your Pro subscription expires in ${daysUntil} days`,
    preheader: `Heads up — your renewal is coming up`,
  };
}

export function getSubscriptionReminderEmailHtml(
  params: SubscriptionReminderEmailParams
): string {
  const renewUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing/upgrade`;
  const urgency = pickUrgency(params.daysUntilExpiry);
  const supportEmail = params.supportEmail || "support@kakamalem.com";

  const body = `
    ${banner({ kind: urgency.kind, text: urgency.label })}
    ${heading(urgency.heading)}
    ${paragraph(`Hi ${escapeHtml(params.ownerName)},`)}
    ${paragraph(`Your <strong>Kaka Malem Pro</strong> subscription for <strong>${escapeHtml(params.storeName)}</strong> is set to expire on <strong>${formatDate(params.expiryDate)}</strong>.`)}
    ${infoTable({
      rows: [
        { label: "Store", value: params.storeName },
        {
          label: "Plan",
          value: `Pro (${params.billingInterval.toLowerCase()})`,
        },
        { label: "Expires", value: formatDate(params.expiryDate) },
      ],
      total: {
        label: "Renewal price",
        value: `${params.planPrice} ${params.currency}`,
      },
    })}
    ${paragraph(`Renew now to keep unlimited products, advanced analytics, custom domains, and priority support active.`)}
    ${
      params.daysUntilExpiry <= 1
        ? paragraph(
            `<strong style="color:${emailTokens.dangerText};">After expiry, your store will revert to the Free plan with a 20-product limit.</strong>`
          )
        : ""
    }
    ${buttonRow(button({ href: renewUrl, label: "Renew now" }))}
    ${contactFooter(supportEmail)}
  `;

  return emailShell({
    title: urgency.heading,
    preheader: urgency.preheader,
    body,
  });
}
