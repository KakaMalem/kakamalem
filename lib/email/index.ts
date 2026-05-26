import nodemailer from "nodemailer";
import {
  button,
  buttonRow,
  emailShell,
  emailTokens,
  heading,
  paragraph,
  escapeHtml,
} from "./styles";

const smtpPort = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // implicit TLS on 465, STARTTLS on 587/2525
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection timeout settings to prevent hanging
  connectionTimeout: 10_000, // 10s to establish connection
  greetingTimeout: 10_000, // 10s for SMTP greeting
  socketTimeout: 15_000, // 15s for socket inactivity
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 3_000, 5_000]; // 1s, 3s, 5s

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const fromName = process.env.SMTP_FROM_NAME || "Kaka Malem";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ""),
        html,
      });

      console.log("Email sent:", info.messageId, `(attempt ${attempt + 1})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(
        `Failed to send email (attempt ${attempt + 1}/${MAX_RETRIES}):`,
        error instanceof Error ? error.message : error
      );

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
  }

  console.error("All email send attempts failed for:", to, "subject:", subject);
  throw lastError;
}

function rawLinkBlock(url: string): string {
  const t = emailTokens;
  return `<p style="color:${t.textSubtle};font-size:12px;line-height:1.5;margin:0;font-family:${t.fontStack};">
    Trouble with the button? Copy this link into your browser:<br>
    <a href="${url}" style="color:${t.primary};word-break:break-all;text-decoration:none;">${escapeHtml(url)}</a>
  </p>`;
}

export function getVerificationEmailHtml(url: string, name?: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const body = `
    ${heading("Verify your email address")}
    ${paragraph(greeting)}
    ${paragraph("Thanks for signing up for Kaka Malem. Tap the button below to confirm your email and finish setting up your account.")}
    ${buttonRow(button({ href: url, label: "Verify email" }))}
    ${paragraph("If you didn't create an account, you can safely ignore this message.", { muted: true })}
    ${paragraph("This link expires in 24 hours.", { muted: true })}
    <hr style="border:none;border-top:1px solid ${emailTokens.borderSubtle};margin:28px 0 18px;">
    ${rawLinkBlock(url)}
  `;
  return emailShell({
    title: "Verify your email",
    preheader:
      "Confirm your email to finish setting up your Kaka Malem account",
    body,
  });
}

export function getPasswordResetEmailHtml(url: string, name?: string) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const body = `
    ${heading("Reset your password")}
    ${paragraph(greeting)}
    ${paragraph("We received a request to reset your Kaka Malem password. Tap the button below to choose a new one.")}
    ${buttonRow(button({ href: url, label: "Reset password" }))}
    ${paragraph("If you didn't request a reset, ignore this email — your password stays the same.", { muted: true })}
    ${paragraph("This link expires in 1 hour.", { muted: true })}
    <hr style="border:none;border-top:1px solid ${emailTokens.borderSubtle};margin:28px 0 18px;">
    ${rawLinkBlock(url)}
  `;
  return emailShell({
    title: "Reset your password",
    preheader: "Choose a new password for your Kaka Malem account",
    body,
  });
}
