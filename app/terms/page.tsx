import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Kaka Malem",
  description:
    "Terms of Service for Kaka Malem - crypto-native escrow marketplace for cross-border trade",
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

export default function TermsPage() {
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
          <span className="text-sm font-medium">Terms of Service</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Terms of Service
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Last updated: April 7, 2026
        </p>

        <div className="mt-10 space-y-10">
          <Section title="Overview">
            <p>
              Kaka Malem (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;)
              is a crypto-native escrow marketplace that connects buyers with
              white-label sellers for cross-border trade. By using Kaka Malem,
              you agree to these terms. If you do not agree, do not use the
              Platform.
            </p>
          </Section>

          <Section title="How the Platform Works">
            <p>
              Kaka Malem acts as a neutral escrow intermediary. We do not sell
              products directly. The transaction flow is:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Seller lists products on their storefront.</li>
              <li>
                Buyer pays in cryptocurrency (USDT/USDC) &mdash; funds are held
                in Kaka Malem&apos;s escrow wallet.
              </li>
              <li>Seller ships the order and uploads a tracking number.</li>
              <li>
                Buyer confirms delivery &mdash; funds are released to the
                seller, minus a 5% platform fee.
              </li>
              <li>
                If the buyer does not act within 30 days of shipment, funds
                auto-release to the seller.
              </li>
              <li>
                Either party may open a dispute. Disputed funds are frozen until
                an admin resolves the case.
              </li>
            </ol>
          </Section>

          <Section title="Accounts">
            <p>You must create an account to use the Platform. You agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Provide accurate, current information.</li>
              <li>Keep your credentials confidential.</li>
              <li>
                Accept responsibility for all activity under your account.
              </li>
              <li>Notify us immediately of unauthorized access.</li>
            </ul>
          </Section>

          <Section title="Seller Obligations">
            <p>As a seller on Kaka Malem, you agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>List only legal, accurately described products.</li>
              <li>Ship orders promptly and provide valid tracking.</li>
              <li>Respond to buyer inquiries and disputes in good faith.</li>
              <li>
                Comply with all applicable laws in your jurisdiction, including
                export regulations.
              </li>
              <li>
                Accept that Kaka Malem deducts a 5% fee from escrow releases as
                the sole platform charge.
              </li>
            </ul>
          </Section>

          <Section title="Buyer Obligations">
            <p>As a buyer, you agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Send the correct payment amount to the escrow wallet address
                provided at checkout.
              </li>
              <li>
                Confirm delivery honestly and promptly when goods are received.
              </li>
              <li>
                Open disputes only for legitimate reasons (non-delivery, wrong
                item, damaged goods).
              </li>
              <li>
                Understand that unconfirmed orders auto-release to the seller
                after 30 days.
              </li>
            </ul>
          </Section>

          <Section title="Fees">
            <p>
              There are no listing fees, subscription fees, or upfront charges.
              Kaka Malem charges a <strong>5% fee</strong> deducted
              automatically when escrow funds are released to the seller. The
              fee percentage is locked at the time of payment and is not
              affected by future changes to the rate. Buyers pay no platform
              fees.
            </p>
          </Section>

          <Section title="Disputes">
            <p>
              Either party may open a dispute while funds are in escrow. Once a
              dispute is opened:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Funds are frozen until the dispute is resolved.</li>
              <li>
                Both parties may submit evidence (messages, photos, tracking
                info).
              </li>
              <li>
                A Kaka Malem admin reviews the case and issues a final, binding
                decision &mdash; either releasing funds to the seller or
                refunding the buyer.
              </li>
            </ul>
          </Section>

          <Section title="Prohibited Activities">
            <p>You may not use the Platform to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Sell illegal, counterfeit, or sanctioned goods.</li>
              <li>
                Engage in fraud, money laundering, or terrorist financing.
              </li>
              <li>Manipulate escrow or dispute processes.</li>
              <li>Circumvent platform fees by transacting off-platform.</li>
              <li>Harass other users or abuse the support system.</li>
            </ul>
            <p>
              Violation may result in immediate account suspension and
              forfeiture of escrowed funds.
            </p>
          </Section>

          <Section title="Cryptocurrency Payments">
            <p>
              All payments are made in cryptocurrency (currently USDT and USDC).
              You acknowledge that:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Blockchain transactions are irreversible. Sending funds to the
                wrong address or on the wrong network cannot be undone.
              </li>
              <li>
                Kaka Malem is not responsible for losses due to user error
                (wrong address, wrong network, insufficient gas).
              </li>
              <li>Network fees (gas) are the sender&apos;s responsibility.</li>
            </ul>
          </Section>

          <Section title="Intellectual Property">
            <p>
              The Platform&apos;s design, code, and branding are owned by Kaka
              Malem. Sellers retain ownership of their product content (images,
              descriptions) and grant us a license to display it on the
              Platform.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              Kaka Malem is provided &quot;as is.&quot; To the maximum extent
              permitted by law, we are not liable for: losses due to
              cryptocurrency volatility, blockchain network failures, seller
              non-delivery, product quality, or any indirect or consequential
              damages. Our total liability is limited to the platform fees
              collected on the specific transaction in question.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may suspend or terminate accounts that violate these terms. You
              may close your account at any time. Upon termination, any pending
              escrow transactions will be resolved according to their current
              status before the account is fully closed.
            </p>
          </Section>

          <Section title="Governing Law">
            <p>
              These terms are governed by the laws of England and Wales. Any
              disputes arising from these terms shall be subject to the
              exclusive jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these terms. Material changes will be communicated
              via email or in-app notification. Continued use after changes take
              effect constitutes acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email us at{" "}
              <a
                href="mailto:legal@kakamalem.com"
                className="font-medium text-foreground underline underline-offset-4"
              >
                legal@kakamalem.com
              </a>
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Kaka Malem</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
