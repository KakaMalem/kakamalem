import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Kaka Malem",
  description:
    "Privacy Policy for Kaka Malem - crypto-native escrow marketplace for cross-border trade",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="scroll-mt-20"
      id={title.toLowerCase().replace(/\s+/g, "-")}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">Privacy Policy</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Privacy Policy
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Last updated: April 7, 2026
        </p>

        <div className="mt-10 space-y-10">
          <Section title="Introduction">
            <p>
              Kaka Malem (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;)
              is a crypto-native escrow marketplace. This policy explains what
              data we collect, why we collect it, and how we protect it. By
              using Kaka Malem, you consent to the practices described here.
            </p>
          </Section>

          <Section title="What We Collect">
            <p>
              <strong className="text-foreground">
                Information you provide:
              </strong>
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Account details &mdash; name, email, password, phone number.
              </li>
              <li>
                Seller information &mdash; store name, branding, product
                listings, crypto wallet addresses for payout.
              </li>
              <li>
                Order and shipping data &mdash; delivery addresses, tracking
                numbers, dispute evidence.
              </li>
              <li>
                Payment data &mdash; transaction hashes, wallet addresses,
                payment amounts. We do not store private keys.
              </li>
            </ul>

            <p className="pt-2">
              <strong className="text-foreground">
                Information collected automatically:
              </strong>
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Device and browser information.</li>
              <li>IP address and approximate location.</li>
              <li>
                Usage data &mdash; pages viewed, actions taken, time spent.
              </li>
              <li>Cookies for authentication and preferences.</li>
            </ul>
          </Section>

          <Section title="How We Use Your Data">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Escrow operations</strong>{" "}
                &mdash; process payments, hold funds, release on confirmation,
                handle disputes.
              </li>
              <li>
                <strong className="text-foreground">Platform operation</strong>{" "}
                &mdash; manage accounts, storefronts, orders, and notifications.
              </li>
              <li>
                <strong className="text-foreground">Security</strong> &mdash;
                detect fraud, prevent abuse, verify transactions.
              </li>
              <li>
                <strong className="text-foreground">Improvement</strong> &mdash;
                analyze usage patterns to improve the Platform.
              </li>
              <li>
                <strong className="text-foreground">Communication</strong>{" "}
                &mdash; send transactional emails (order updates, dispute
                notifications) and, with consent, marketing updates.
              </li>
              <li>
                <strong className="text-foreground">Legal compliance</strong>{" "}
                &mdash; meet regulatory obligations, respond to lawful requests.
              </li>
            </ul>
          </Section>

          <Section title="Who We Share Data With">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">
                  Buyers &harr; Sellers
                </strong>{" "}
                &mdash; order details, shipping addresses, and tracking info are
                shared between transaction parties.
              </li>
              <li>
                <strong className="text-foreground">Service providers</strong>{" "}
                &mdash; hosting, email delivery, and analytics services that
                process data on our behalf under strict agreements.
              </li>
              <li>
                <strong className="text-foreground">Legal authorities</strong>{" "}
                &mdash; when required by law, court order, or to prevent harm.
              </li>
              <li>
                <strong className="text-foreground">Business transfers</strong>{" "}
                &mdash; in the event of a merger, acquisition, or asset sale.
              </li>
            </ul>
            <p className="pt-1 font-medium text-foreground">
              We never sell your personal data.
            </p>
          </Section>

          <Section title="Blockchain Data">
            <p>
              Cryptocurrency transactions are recorded on public blockchains.
              Wallet addresses and transaction hashes associated with your
              orders are inherently public and cannot be deleted from the
              blockchain. We store this data in our database to link on-chain
              transactions to your orders.
            </p>
          </Section>

          <Section title="Data Security">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>TLS encryption for all data in transit.</li>
              <li>Passwords hashed with industry-standard algorithms.</li>
              <li>
                Escrow wallet keys stored securely with restricted access.
              </li>
              <li>Daily encrypted database backups.</li>
              <li>
                Role-based access controls &mdash; staff can only access data
                relevant to their function.
              </li>
            </ul>
            <p>
              No system is 100% secure. We commit to promptly notifying affected
              users if a breach occurs.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              We retain your data while your account is active. After account
              deletion:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Personal data is deleted or anonymized within 30 days.</li>
              <li>
                Transaction records are retained for 7 years for legal and
                financial compliance.
              </li>
              <li>
                Blockchain data (wallet addresses, tx hashes) remains on-chain
                permanently.
              </li>
            </ul>
          </Section>

          <Section title="Your Rights">
            <p>You can:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-foreground">Access</strong> your
                personal data via your account settings.
              </li>
              <li>
                <strong className="text-foreground">Correct</strong> inaccurate
                information in your profile.
              </li>
              <li>
                <strong className="text-foreground">Delete</strong> your account
                and associated data (subject to retention obligations above).
              </li>
              <li>
                <strong className="text-foreground">Export</strong> your data in
                a portable format.
              </li>
              <li>
                <strong className="text-foreground">Opt out</strong> of
                marketing emails at any time.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:privacy@kakamalem.com"
                className="font-medium text-foreground underline underline-offset-4"
              >
                privacy@kakamalem.com
              </a>
            </p>
          </Section>

          <Section title="Cookies">
            <p>We use essential cookies for:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Authentication (keeping you logged in).</li>
              <li>Preferences (currency, language).</li>
              <li>Security (CSRF protection).</li>
            </ul>
            <p>
              We use optional analytics cookies to understand usage patterns.
              You can disable non-essential cookies in your browser settings.
            </p>
          </Section>

          <Section title="Age Requirement">
            <p>
              Kaka Malem is not intended for users under 18. We do not knowingly
              collect data from minors. If we learn we have collected data from
              a minor, we will delete it promptly.
            </p>
          </Section>

          <Section title="International Transfers">
            <p>
              Kaka Malem is operated from the United Kingdom with infrastructure
              that may span multiple countries. By using the Platform, you
              consent to your data being transferred to and processed in
              jurisdictions outside your own.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update this policy. Material changes will be communicated
              via email or in-app notification at least 14 days before taking
              effect. The &quot;Effective&quot; date at the top reflects the
              latest version.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Privacy questions? Email us at{" "}
              <a
                href="mailto:privacy@kakamalem.com"
                className="font-medium text-foreground underline underline-offset-4"
              >
                privacy@kakamalem.com
              </a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Kaka Malem</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
