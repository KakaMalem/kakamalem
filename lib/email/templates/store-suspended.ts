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
    ? `
    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #9a3412; text-transform: uppercase; letter-spacing: 0.05em;">Reason</p>
      <p style="margin: 0; color: #7c2d12; font-size: 14px; white-space: pre-wrap;">${escapeHtml(params.reason.trim())}</p>
    </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Store Suspended</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Kaka Malem</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 20px;">
      <span style="color: #991b1b; font-weight: 600; font-size: 14px;">&#9888; Store Suspended</span>
    </div>

    <h2 style="color: #333; margin-top: 0;">Your store has been suspended</h2>

    <p>Hi ${escapeHtml(params.ownerName)},</p>

    <p>We're writing to let you know that your store <strong>${escapeHtml(params.storeName)}</strong> has been suspended by the Kaka Malem team.</p>

    ${reasonBlock}

    <p>While the store is suspended:</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #dc2626; margin-right: 8px;">&#10007;</span>
            Customers cannot access your storefront
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #dc2626; margin-right: 8px;">&#10007;</span>
            New orders cannot be placed
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #16a34a; margin-right: 8px;">&#10003;</span>
            Your products, orders, and customer data remain safe
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #16a34a; margin-right: 8px;">&#10003;</span>
            You can still sign in to your dashboard
          </td>
        </tr>
      </table>
    </div>

    <p>If you believe this is a mistake or would like to resolve the issue, please reply to this email or contact us at <a href="mailto:${params.supportEmail}" style="color: #667eea;">${params.supportEmail}</a>. We'll get back to you as soon as possible.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin: 0;">
      You are receiving this email because you are an owner or admin of ${escapeHtml(params.storeName)} on Kaka Malem.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Kaka Malem. All rights reserved.</p>
  </div>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
