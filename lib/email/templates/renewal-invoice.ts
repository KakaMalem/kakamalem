import {
  banner,
  button,
  buttonRow,
  contactFooter,
  emailShell,
  heading,
  infoTable,
  paragraph,
  escapeHtml,
} from "../styles";

interface RenewalInvoiceEmailParams {
  ownerName: string;
  storeName: string;
  storeSlug: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  billingInterval: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
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

export function getRenewalInvoiceEmailHtml(
  params: RenewalInvoiceEmailParams
): string {
  const payUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing/upgrade`;
  const supportEmail = params.supportEmail || "support@kakamalem.com";

  const body = `
    ${banner({ kind: "info", text: "Renewal Invoice", icon: "&#128196;" })}
    ${heading("Time to renew your subscription")}
    ${paragraph(`Hi ${escapeHtml(params.ownerName)},`)}
    ${paragraph(`Your <strong>Kaka Malem Pro</strong> subscription for <strong>${escapeHtml(params.storeName)}</strong> is due for renewal. We've prepared the invoice for the next billing period.`)}
    ${infoTable({
      rows: [
        { label: "Invoice #", value: params.invoiceNumber, emphasis: true },
        {
          label: "Plan",
          value: `Pro (${params.billingInterval.toLowerCase()})`,
        },
        {
          label: "Period",
          value: `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`,
        },
        { label: "Due date", value: formatDate(params.dueDate) },
      ],
      total: {
        label: "Amount due",
        value: `${params.amount} ${params.currency}`,
      },
    })}
    ${paragraph(`Pay before the due date to avoid any interruption to your Pro features.`)}
    ${buttonRow(button({ href: payUrl, label: "Pay now" }))}
    ${contactFooter(supportEmail)}
  `;

  return emailShell({
    title: `Renewal invoice ${params.invoiceNumber}`,
    preheader: `${params.amount} ${params.currency} due by ${formatDate(params.dueDate)}`,
    body,
  });
}
