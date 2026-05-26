interface SubscriptionExpiredEmailParams {
  ownerName: string;
  storeName: string;
  storeSlug: string;
  expiredDate: string;
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

export function getSubscriptionExpiredEmailHtml(
  params: SubscriptionExpiredEmailParams
): string {
  const reactivateUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing/upgrade`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expired</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Kaka Malem</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <!-- Expired Banner -->
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 20px;">
      <span style="color: #991b1b; font-weight: 600; font-size: 14px;">&#10007; Subscription Expired</span>
    </div>

    <h2 style="color: #333; margin-top: 0;">Your Pro subscription has expired</h2>

    <p>Hi ${params.ownerName},</p>

    <p>Your <strong>Kaka Malem Pro</strong> subscription for <strong>${params.storeName}</strong> expired on <strong>${formatDate(params.expiredDate)}</strong>.</p>

    <p>Your store has been downgraded to the <strong>Free plan</strong>. Here's what this means:</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #dc2626; margin-right: 8px;">&#10007;</span>
            Product limit reduced to <strong>20 products</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #dc2626; margin-right: 8px;">&#10007;</span>
            Advanced analytics disabled
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #dc2626; margin-right: 8px;">&#10007;</span>
            Priority support no longer available
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #16a34a; margin-right: 8px;">&#10003;</span>
            Your data and existing products are safe
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px;">
            <span style="color: #16a34a; margin-right: 8px;">&#10003;</span>
            Store remains online for customers
          </td>
        </tr>
      </table>
    </div>

    <p>You can reactivate Pro anytime to restore unlimited products and all premium features.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${reactivateUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Reactivate Pro
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin: 0;">
      If you have any questions, contact us at support@kakamalem.com
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>&copy; ${new Date().getFullYear()} Kaka Malem. All rights reserved.</p>
  </div>
</body>
</html>
`;
}
