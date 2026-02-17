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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Kaka Malem</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Payment Confirmed</h2>

    <p>Hi ${params.ownerName},</p>

    <p>Your subscription payment for <strong>${params.storeName}</strong> has been processed successfully.</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Invoice #</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">${params.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Plan</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">${params.planName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Period</td>
          <td style="padding: 6px 0; text-align: right; font-size: 14px;">${formatDate(params.periodStart)} - ${formatDate(params.periodEnd)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Payment Method</td>
          <td style="padding: 6px 0; text-align: right; font-size: 14px;">${params.paymentMethod}</td>
        </tr>
        <tr style="border-top: 2px solid #7c3aed;">
          <td style="padding: 10px 0 6px; color: #111827; font-weight: 700; font-size: 16px;">Amount Paid</td>
          <td style="padding: 10px 0 6px; text-align: right; color: #7c3aed; font-weight: 700; font-size: 16px;">${params.amount} ${params.currency}</td>
        </tr>
      </table>
    </div>

    <div style="background: #dcfce7; border-radius: 6px; padding: 12px; text-align: center; margin: 20px 0;">
      <span style="color: #166534; font-weight: 600; font-size: 14px;">&#10003; Payment Successful</span>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin-right: 10px;">
        View Billing
      </a>
      <a href="${downloadUrl}" style="background: #f3f4f6; color: #374151; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; border: 1px solid #e5e7eb;">
        Download PDF
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin: 0;">
      If you have any questions about this invoice, contact us at kakamalem.team@gmail.com
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Kaka Malem. All rights reserved.</p>
  </div>
</body>
</html>
`;
}
