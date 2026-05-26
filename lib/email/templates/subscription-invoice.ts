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

interface SubscriptionInvoiceEmailParams {
  ownerName: string;
  storeName: string;
  storeSlug: string;
  invoiceNumber: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  pdfUrl: string;
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

export function getSubscriptionInvoiceEmailHtml(
  params: SubscriptionInvoiceEmailParams
): string {
  const dashboardUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing`;
  const downloadUrl = params.pdfUrl.startsWith("http")
    ? params.pdfUrl
    : `${params.baseUrl}${params.pdfUrl}`;
  const supportEmail = params.supportEmail || "support@kakamalem.com";

  const body = `
    ${banner({ kind: "success", text: "Payment Successful" })}
    ${heading("Payment confirmed")}
    ${paragraph(`Hi ${escapeHtml(params.ownerName)},`)}
    ${paragraph(`Your subscription payment for <strong>${escapeHtml(params.storeName)}</strong> has been processed. A receipt is attached below and available in your dashboard.`)}
    ${infoTable({
      rows: [
        { label: "Invoice #", value: params.invoiceNumber, emphasis: true },
        { label: "Plan", value: params.planName },
        {
          label: "Period",
          value: `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`,
        },
        { label: "Payment method", value: params.paymentMethod },
      ],
      total: {
        label: "Amount paid",
        value: `${params.amount} ${params.currency}`,
      },
    })}
    ${buttonRow(
      `${button({ href: dashboardUrl, label: "View billing" })}
       <span style="display:inline-block;width:10px;"></span>
       ${button({ href: downloadUrl, label: "Download PDF", variant: "secondary" })}`
    )}
    ${contactFooter(supportEmail)}
  `;

  return emailShell({
    title: "Payment confirmed",
    preheader: `Invoice ${params.invoiceNumber} — ${params.amount} ${params.currency} paid`,
    body,
  });
}
