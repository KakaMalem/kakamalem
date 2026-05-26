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
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getUrgencyStyles(daysUntil: number) {
  if (daysUntil <= 1) {
    return {
      bannerBg: "#fef2f2",
      bannerBorder: "#fecaca",
      bannerColor: "#991b1b",
      bannerIcon: "&#9888;",
      bannerText: "Final Notice",
      heading: "Your Pro subscription expires tomorrow!",
    };
  }
  if (daysUntil <= 3) {
    return {
      bannerBg: "#fffbeb",
      bannerBorder: "#fde68a",
      bannerColor: "#92400e",
      bannerIcon: "&#9888;",
      bannerText: "Expiring Soon",
      heading: `Your Pro subscription expires in ${daysUntil} days`,
    };
  }
  return {
    bannerBg: "#eff6ff",
    bannerBorder: "#bfdbfe",
    bannerColor: "#1e40af",
    bannerIcon: "&#128197;",
    bannerText: "Renewal Reminder",
    heading: `Your Pro subscription expires in ${daysUntil} days`,
  };
}

export function getSubscriptionReminderEmailHtml(
  params: SubscriptionReminderEmailParams
): string {
  const renewUrl = `${params.baseUrl}/dashboard/${params.storeSlug}/billing/upgrade`;
  const urgency = getUrgencyStyles(params.daysUntilExpiry);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Renewal Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Kaka Malem</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <!-- Urgency Banner -->
    <div style="background: ${urgency.bannerBg}; border: 1px solid ${urgency.bannerBorder}; border-radius: 6px; padding: 12px; text-align: center; margin-bottom: 20px;">
      <span style="color: ${urgency.bannerColor}; font-weight: 600; font-size: 14px;">${urgency.bannerIcon} ${urgency.bannerText}</span>
    </div>

    <h2 style="color: #333; margin-top: 0;">${urgency.heading}</h2>

    <p>Hi ${params.ownerName},</p>

    <p>Your <strong>Kaka Malem Pro</strong> subscription for <strong>${params.storeName}</strong> is expiring on <strong>${formatDate(params.expiryDate)}</strong>.</p>

    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Store</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">${params.storeName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Plan</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">Pro (${params.billingInterval})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Expires</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; font-size: 14px;">${formatDate(params.expiryDate)}</td>
        </tr>
        <tr style="border-top: 2px solid #7c3aed;">
          <td style="padding: 10px 0 6px; color: #111827; font-weight: 700; font-size: 16px;">Renewal Price</td>
          <td style="padding: 10px 0 6px; text-align: right; color: #7c3aed; font-weight: 700; font-size: 16px;">${params.planPrice} ${params.currency}</td>
        </tr>
      </table>
    </div>

    <p>To keep your Pro features (unlimited products, advanced analytics, and more), renew your subscription before it expires.</p>

    ${params.daysUntilExpiry <= 1 ? '<p style="color: #dc2626; font-weight: 600;">After expiry, your store will revert to the Free plan with a 20-product limit.</p>' : ""}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${renewUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
        Renew Now
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
