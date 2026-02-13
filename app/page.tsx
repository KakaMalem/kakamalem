import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { HeroMockup } from "@/components/landing/hero-mockup";
import { FeatureCard } from "@/components/landing/feature-card";
import { PricingCard } from "@/components/landing/pricing-card";
import { FaqSection } from "@/components/landing/faq-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNavbar } from "@/components/landing/landing-navbar";

const features = [
  {
    icon: "rocket" as const,
    title: "Go live in minutes",
    description:
      "Your store ready to accept orders today. No coding or technical knowledge required — just sign up and start adding products.",
  },
  {
    icon: "palette" as const,
    title: "Make it uniquely yours",
    description:
      "Upload your logo, choose your colors, and customize your store's look. Create a brand that stands out from the competition.",
  },
  {
    icon: "package" as const,
    title: "Sell smarter",
    description:
      "Manage inventory with ease. Track stock levels, create product variants, and get alerts when items run low.",
  },
  {
    icon: "clipboard" as const,
    title: "Never miss a sale",
    description:
      "Get instant notifications for new orders. Manage everything from one dashboard — orders, customers, and payments.",
  },
  {
    icon: "globe" as const,
    title: "Reach more customers",
    description:
      "SEO-optimized pages help customers find you on Google. Share products directly to social media with one click.",
  },
  {
    icon: "chart" as const,
    title: "Grow with confidence",
    description:
      "Understand your business with detailed analytics. Track sales trends, popular products, and customer behavior.",
  },
];

const pricingPlans = [
  {
    name: "Free Trial",
    price: "Free",
    description: "Try everything for 7 days",
    features: [
      "Up to 20 products",
      "All features included",
      "Custom store branding",
      "Order management",
      "Basic analytics",
    ],
    cta: "Start Free Trial",
    ctaHref: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$15",
    period: "month",
    description: "Everything you need to grow",
    features: [
      "Unlimited products",
      "Priority support",
      "Custom domain",
      "No transaction fees",
    ],
    cta: "Upgrade to Pro",
    ctaHref: "/signup",
    highlighted: true,
  },
];

export default async function Home() {
  const user = await getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar user={user} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="landing-section py-16 md:py-24 lg:py-32">
          <div className="landing-section-content">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Text content */}
              <div className="text-center lg:text-left">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Create your Store
                  <br />
                  <span className="text-muted-foreground">In 5 Minutes</span>
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
                  Create a beautiful online store in minutes. No coding
                  required, no upfront costs. Start selling to customers
                  worldwide.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                  <Button size="lg" className="w-full sm:w-auto" asChild>
                    <Link href={user ? "/dashboard" : "/signup"}>
                      {user ? "Go to Dashboard" : "Create Your Free Store"}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    asChild
                  >
                    <Link href="/marketplace">Browse Marketplace</Link>
                  </Button>
                </div>

                {/* Trust indicators */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    7-day free trial
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    No credit card required
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    Cancel anytime
                  </span>
                </div>
              </div>

              {/* Hero mockup */}
              <div className="min-w-0">
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="landing-section border-t bg-muted/30 py-16 md:py-24"
        >
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to sell online
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Powerful features designed for your business. Simple to use,
                built to grow with you.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  index={index}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="landing-section border-t py-16 md:py-24">
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get started in 3 easy steps
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                From signup to your first sale — it only takes a few minutes
              </p>
            </div>
            <div className="mt-12 md:mt-16">
              <HowItWorks />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="pricing"
          className="landing-section border-t bg-muted/30 py-16 md:py-24"
        >
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Start free, upgrade when you&apos;re ready. No hidden fees, no
                surprises.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-3xl gap-8 md:grid-cols-2">
              {pricingPlans.map((plan, index) => (
                <PricingCard
                  key={plan.name}
                  {...plan}
                  ctaHref={user ? "/dashboard" : plan.ctaHref}
                  index={index}
                  isLoggedIn={!!user}
                />
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              No transaction fees — you keep 100% of your sales
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="landing-section border-t py-16 md:py-24">
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Everything you need to know about Kaka Malem
              </p>
            </div>
            <div className="mt-12">
              <FaqSection />
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="landing-section border-t bg-muted/30 py-16 md:py-24">
          <div className="landing-section-content text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to start your online business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Join thousands of merchants selling online with Kaka Malem. Your
              store is just a few clicks away.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href={user ? "/dashboard" : "/signup"}>
                {user ? "Go to Dashboard" : "Create Your Free Store"}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-section border-t py-12">
        <div className="landing-section-content">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="text-xl font-bold">
                Kaka Malem
              </Link>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                The easiest way to create and manage your online store.
              </p>
            </div>

            {/* Product links */}
            <div>
              <h3 className="font-semibold">Product</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/store/kakamalem"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Demo Store
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h3 className="font-semibold">Company</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="#faq"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/affiliate"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Become an Affiliate
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Kaka Malem. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
