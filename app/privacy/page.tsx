import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Kaka Malem",
  description: "Privacy Policy for Kaka Malem - e-commerce platform",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">Last updated: January 2025</p>

        <div className="prose prose-gray mt-8 max-w-none">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Introduction</h2>
            <p className="text-muted-foreground">
              At Kaka Malem, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our e-commerce platform.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">2. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly to us:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Account Information:</strong> Name, email address,
                password, and phone number
              </li>
              <li>
                <strong>Store Information:</strong> Store name, description,
                logo, and branding details
              </li>
              <li>
                <strong>Product Information:</strong> Product listings, images,
                prices, and inventory data
              </li>
              <li>
                <strong>Order Information:</strong> Customer orders, shipping
                addresses, and transaction history
              </li>
              <li>
                <strong>Payment Information:</strong> Billing details for
                subscription payments
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              3. Information Collected Automatically
            </h2>
            <p className="text-muted-foreground">
              When you use our platform, we automatically collect:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and location data</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              4. How We Use Your Information
            </h2>
            <p className="text-muted-foreground">
              We use the collected information to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Provide and maintain our services</li>
              <li>Process transactions and manage your account</li>
              <li>Send important updates and notifications</li>
              <li>Improve our platform and develop new features</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              5. Information Sharing and Disclosure
            </h2>
            <p className="text-muted-foreground">
              We may share your information with:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <strong>Service Providers:</strong> Third parties that help us
                operate our platform (hosting, analytics, etc.)
              </li>
              <li>
                <strong>Store Customers:</strong> Order and shipping information
                is shared with customers who purchase from your store
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to
                protect our rights
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with a
                merger, acquisition, or sale of assets
              </li>
            </ul>
            <p className="mt-4 text-muted-foreground">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">6. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate security measures to protect your
              information:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>SSL encryption for all data transmission</li>
              <li>Secure password hashing</li>
              <li>Regular security audits and updates</li>
              <li>Daily database backups</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your information for as long as your account is active
              or as needed to provide you services. After account deletion, we
              may retain certain information as required by law or for
              legitimate business purposes.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">8. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="mt-4 text-muted-foreground">
              To exercise these rights, please contact us or use the settings in
              your dashboard.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">9. Cookies</h2>
            <p className="text-muted-foreground">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Keep you logged in to your account</li>
              <li>Remember your preferences</li>
              <li>Analyze platform usage and performance</li>
              <li>Provide a personalized experience</li>
            </ul>
            <p className="mt-4 text-muted-foreground">
              You can control cookies through your browser settings, but
              disabling them may affect platform functionality.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              10. Children&apos;s Privacy
            </h2>
            <p className="text-muted-foreground">
              Our services are not intended for users under the age of 18. We do
              not knowingly collect information from children.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">
              11. Changes to This Policy
            </h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new policy on this page
              and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">12. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy, please contact us
              at{" "}
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
