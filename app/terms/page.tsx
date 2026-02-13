import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Kaka Malem",
  description: "Terms of Service for Kaka Malem - e-commerce platform",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/60">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Link href="/" className="text-xl font-bold">
            Kaka Malem
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-muted-foreground">Last updated: January 2025</p>

        <div className="prose prose-gray mt-8 max-w-none">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Kaka Malem (&quot;the Platform&quot;), you
              agree to be bound by these Terms of Service. If you do not agree
              to these terms, please do not use our services.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p className="text-muted-foreground">
              Kaka Malem is an e-commerce platform that allows users to create
              and manage online stores. We provide tools for product management,
              order processing, and customer engagement.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">3. User Accounts</h2>
            <p className="text-muted-foreground">
              To use our services, you must create an account. You are
              responsible for:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                Maintaining the confidentiality of your account credentials
              </li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              4. Store Owner Responsibilities
            </h2>
            <p className="text-muted-foreground">
              As a store owner, you agree to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Sell only legal products and services</li>
              <li>Provide accurate product descriptions and pricing</li>
              <li>Fulfill orders in a timely manner</li>
              <li>Handle customer inquiries and complaints professionally</li>
              <li>Comply with all applicable local laws and regulations</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">5. Prohibited Activities</h2>
            <p className="text-muted-foreground">
              You may not use our platform to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Sell illegal, counterfeit, or prohibited items</li>
              <li>Engage in fraudulent activities</li>
              <li>Violate intellectual property rights</li>
              <li>Distribute malware or harmful content</li>
              <li>Harass or harm other users</li>
              <li>Manipulate or abuse the platform</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              6. Subscription and Payments
            </h2>
            <p className="text-muted-foreground">
              Kaka Malem offers a free trial period followed by paid
              subscription plans. By subscribing to a paid plan:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>You agree to pay the applicable subscription fees</li>
              <li>Payments are processed through approved payment methods</li>
              <li>Subscriptions may be cancelled at any time</li>
              <li>Refunds are handled on a case-by-case basis</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Kaka Malem platform, including its design, features, and
              content, is owned by us and protected by intellectual property
              laws. You retain ownership of the content you upload to your
              store.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              8. Limitation of Liability
            </h2>
            <p className="text-muted-foreground">
              Kaka Malem is provided &quot;as is&quot; without warranties of any
              kind. We are not liable for any indirect, incidental, or
              consequential damages arising from your use of the platform.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">9. Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to suspend or terminate your account if you
              violate these terms. You may also close your account at any time
              through your dashboard settings.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">10. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these terms from time to time. Continued use of the
              platform after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms of Service, please contact
              us at{" "}
              <a
                href="mailto:kakamalem.team@gmail.com"
                className="text-primary underline"
              >
                kakamalem.team@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kaka Malem. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
