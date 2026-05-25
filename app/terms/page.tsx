import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Kaka Malem",
  description:
    "Terms of Service for Kaka Malem — a storefront builder for Afghan businesses.",
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
          Last updated: May 16, 2026
        </p>

        <div className="mt-10 space-y-10">
          <Section title="Overview">
            <p>
              Kaka Malem (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;)
              is a multi-tenant storefront builder. Sellers create their own
              online store, list products, and accept payments via HesabPay or
              cash on delivery. By using Kaka Malem, you agree to these terms.
              If you do not agree, do not use the Platform.
            </p>
          </Section>

          <Section title="How the Platform Works">
            <p>
              Kaka Malem provides software for sellers to run their own
              storefronts. We do not sell products directly. The transaction
              flow is:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Seller signs up, picks a plan, and creates a storefront.</li>
              <li>
                Seller lists products and configures which payment methods to
                accept (HesabPay card payments, cash on delivery).
              </li>
              <li>
                Customers shop on the storefront and check out. Card payments
                are processed by HesabPay&apos;s hosted checkout; COD orders are
                paid to the courier on delivery.
              </li>
              <li>
                Seller fulfills the order and updates its status. The Platform
                tracks orders, inventory, and analytics.
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
              <li>Fulfill orders promptly and honor your stated policies.</li>
              <li>
                Respond to customer inquiries and complaints in good faith.
              </li>
              <li>
                Comply with all applicable laws in your jurisdiction, including
                tax, consumer protection, and import/export regulations.
              </li>
              <li>
                Pay your Pro subscription fee on time if you have upgraded from
                the Free plan.
              </li>
              <li>
                Handle refunds and disputes with your customers directly. The
                Platform provides tooling but does not act as an intermediary.
              </li>
            </ul>
          </Section>

          <Section title="Buyer Obligations">
            <p>As a customer of a seller&apos;s storefront, you agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Provide accurate shipping and contact information at checkout.
              </li>
              <li>
                Pay for items via the seller&apos;s configured payment method
                (HesabPay or COD).
              </li>
              <li>
                Address any order issues (delivery problems, refunds, returns)
                directly with the seller. Kaka Malem is not a party to the
                buyer/seller transaction.
              </li>
            </ul>
          </Section>

          <Section title="Fees">
            <p>Kaka Malem operates on a subscription model:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Free plan:</strong> Limited product count, full feature
                set otherwise.
              </li>
              <li>
                <strong>Pro plan:</strong> Unlimited products. Billed monthly or
                yearly via HesabPay invoices.
              </li>
              <li>
                <strong>No per-transaction fee:</strong> Sellers keep 100% of
                order revenue. HesabPay&apos;s payment processing fees apply
                separately and are between the seller and HesabPay.
              </li>
            </ul>
            <p>
              Current pricing is shown on the billing page in your dashboard. We
              may change pricing with at least 30 days&apos; notice; existing
              subscribers retain their current rate until renewal.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Online card payments are processed by HesabPay through their
              hosted checkout. Kaka Malem does not see, store, or process card
              numbers. HesabPay&apos;s terms apply to card transactions on top
              of these terms.
            </p>
            <p>
              Cash on Delivery is handled directly between the seller, the
              courier, and the buyer. The Platform records the order but is not
              involved in collecting payment.
            </p>
          </Section>

          <Section title="Prohibited Activities">
            <p>You may not use the Platform to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Sell illegal, counterfeit, or sanctioned goods.</li>
              <li>
                Engage in fraud, money laundering, or other financial crimes.
              </li>
              <li>
                Misrepresent products, hide fees, or otherwise deceive
                customers.
              </li>
              <li>Harass other users or abuse the support system.</li>
              <li>
                Attempt to disrupt the Platform&apos;s operation or bypass usage
                limits.
              </li>
            </ul>
            <p>
              Violation may result in immediate account suspension and removal
              of your storefront.
            </p>
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
              seller/buyer disputes, product quality issues, courier delays,
              payment processor failures, or any indirect or consequential
              damages. Our total liability is limited to the subscription fees
              you paid us in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may suspend or terminate accounts that violate these terms. You
              may close your account at any time from your dashboard. Upon
              termination, your storefront is taken offline and your data is
              retained per our Privacy Policy.
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
