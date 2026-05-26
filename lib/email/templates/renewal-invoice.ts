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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Renewal Invoice</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #000000; background-color: #000000; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px;"><font color="#ffffff">Kaka Malem</font></h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Renewal Invoice</h2>

    <p>Hi ${params.ownerName},</p>

    <p>Your <strong>Kaka Malem Pro</strong> subscription for <strong>${params.storeName}</strong> is due for renewal. We've generated an invoice for the next billing period.</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Invoice #</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Plan</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">Pro (${params.billingInterval})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Period</td>
          <td style="padding: 6px 0; text-align: right; font-size: 14px;">${formatDate(params.periodStart)} - ${formatDate(params.periodEnd)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Due Date</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px; color: #dc2626;">${formatDate(params.dueDate)}</td>
        </tr>
        <tr style="border-top: 2px solid #7c3aed;">
          <td style="padding: 10px 0 6px; color: #111827; font-weight: 700; font-size: 16px;">Amount Due</td>
          <td style="padding: 10px 0 6px; text-align: right; color: #7c3aed; font-weight: 700; font-size: 16px;">${params.amount} ${params.currency}</td>
        </tr>
      </table>
    </div>

    <p>Please complete your payment before the due date to avoid any interruption to your Pro features.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${payUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Pay Now
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin: 0;">
      If you have any questions about this invoice, contact us at ${supportEmail}
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Kaka Malem. All rights reserved.</p>
  </div>
</body>
</html>
`;
}
