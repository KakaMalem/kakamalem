import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { getCurrentUserAffiliateStatus } from "@/lib/actions/platform-affiliates";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Users,
  TrendingUp,
  Wallet,
  Clock,
  Award,
  CheckCircle2,
  Gift,
  LayoutDashboard,
} from "lucide-react";
import { AFFILIATE_TIERS, AFFILIATE_CONFIG } from "@/lib/affiliate/constants";
import { LandingNavbar } from "@/components/landing/landing-navbar";

export const metadata = {
  title: "Affiliate Program | Kaka Malem",
  description:
    "Join the Kaka Malem affiliate program. Earn up to 50% commission for 12 months on every store you refer.",
};

export default async function AffiliateProgramPage() {
  const user = await getUser();

  // Check affiliate status if user is logged in
  let affiliateStatus: {
    hasApplied: boolean;
    status?: "pending" | "approved" | "suspended" | "rejected";
    slug?: string;
  } = { hasApplied: false };

  if (user) {
    const statusResult = await getCurrentUserAffiliateStatus();
    if (statusResult.data) {
      affiliateStatus = statusResult.data;
    }
  }

  const isApprovedAffiliate = affiliateStatus.status === "approved";

  const affiliateNavLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Commission Tiers", href: "#tiers" },
  ];

  // Build CTAs based on user and affiliate status
  // Note: Portals are isolated - no cross-links between affiliate/store/delivery dashboards
  let affiliateCTAs;
  if (!user) {
    affiliateCTAs = [
      { label: "Login", href: "/login", variant: "outline" as const },
      {
        label: "Apply Now",
        href: "/become-affiliate",
        variant: "default" as const,
      },
    ];
  } else if (isApprovedAffiliate) {
    affiliateCTAs = [
      {
        label: "Dashboard",
        href: "/affiliate/dashboard",
        variant: "default" as const,
      },
    ];
  } else {
    affiliateCTAs = [
      {
        label: "Apply Now",
        href: "/become-affiliate",
        variant: "default" as const,
      },
    ];
  }

  return (
    <div className="flex min-h-screen flex-col">
      <LandingNavbar
        user={user}
        navLinks={affiliateNavLinks}
        ctas={affiliateCTAs}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="landing-section py-16 md:py-24 lg:py-32">
          <div className="landing-section-content">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border bg-primary/5 px-4 py-1.5 text-sm font-medium mb-6">
                <Gift className="size-4 text-primary" />
                Earn up to 50% commission
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Partner with Kaka Malem
                <br />
                <span className="text-muted-foreground">
                  Earn While You Share
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Help entrepreneurs launch their online stores and earn recurring
                commissions for 12 months on every successful referral.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                {isApprovedAffiliate ? (
                  <Button size="lg" asChild>
                    <Link href="/affiliate/dashboard">
                      <LayoutDashboard className="mr-2 size-4" />
                      Go to Dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" asChild>
                      <Link href="/become-affiliate">
                        Apply Now
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="#how-it-works">Learn How It Works</Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Trust indicators */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  {AFFILIATE_CONFIG.cookieDurationDays}-day cookie
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  {AFFILIATE_CONFIG.commissionDurationMonths} months of
                  commissions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  No minimum payout
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="landing-section border-t border-b bg-muted/30 py-12">
          <div className="landing-section-content">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">
                  {AFFILIATE_CONFIG.cookieDurationDays}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Day Cookie Duration
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">
                  {AFFILIATE_CONFIG.commissionDurationMonths}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Months of Commissions
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">
                  {AFFILIATE_TIERS.gold.commissionRate}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Max Commission Rate
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">0 AFN</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Minimum Payout
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="landing-section py-16 md:py-24">
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                How It Works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Start earning in three simple steps
              </p>
            </div>

            <div className="mt-12 md:mt-16 grid md:grid-cols-3 gap-8 md:gap-12">
              <div className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <Users className="size-8" />
                </div>
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-3">
                  1
                </span>
                <h3 className="text-xl font-semibold">Share Your Link</h3>
                <p className="mt-2 text-muted-foreground">
                  Get your unique affiliate link (e.g., kakamalem.com/yourname)
                  and share it with your audience.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <TrendingUp className="size-8" />
                </div>
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-3">
                  2
                </span>
                <h3 className="text-xl font-semibold">Refer Stores</h3>
                <p className="mt-2 text-muted-foreground">
                  When someone creates a store through your link, they&apos;re
                  tracked as your referral for{" "}
                  {AFFILIATE_CONFIG.cookieDurationDays} days.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <Wallet className="size-8" />
                </div>
                <span className="inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-3">
                  3
                </span>
                <h3 className="text-xl font-semibold">Earn Commissions</h3>
                <p className="mt-2 text-muted-foreground">
                  Earn a percentage of every subscription payment for{" "}
                  {AFFILIATE_CONFIG.commissionDurationMonths} months after they
                  subscribe.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Commission Tiers */}
        <section
          id="tiers"
          className="landing-section border-t bg-muted/30 py-16 md:py-24"
        >
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Commission Tiers
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                The more stores you refer, the higher your commission rate
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-6">
              {/* Bronze */}
              <div className="rounded-xl border bg-background p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Award className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {AFFILIATE_TIERS.bronze.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {AFFILIATE_TIERS.bronze.minReferrals}-
                      {AFFILIATE_TIERS.bronze.maxReferrals} referrals
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">
                    {AFFILIATE_TIERS.bronze.commissionRate}%
                  </span>
                  <span className="text-muted-foreground ml-2">commission</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {AFFILIATE_TIERS.bronze.description}
                </p>
              </div>

              {/* Silver */}
              <div className="rounded-xl border-2 border-primary bg-background p-6 shadow-sm relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Popular
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                    <Award className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {AFFILIATE_TIERS.silver.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {AFFILIATE_TIERS.silver.minReferrals}-
                      {AFFILIATE_TIERS.silver.maxReferrals} referrals
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">
                    {AFFILIATE_TIERS.silver.commissionRate}%
                  </span>
                  <span className="text-muted-foreground ml-2">commission</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {AFFILIATE_TIERS.silver.description}
                </p>
              </div>

              {/* Gold */}
              <div className="rounded-xl border bg-background p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                    <Award className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {AFFILIATE_TIERS.gold.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {AFFILIATE_TIERS.gold.minReferrals}+ referrals
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">
                    {AFFILIATE_TIERS.gold.commissionRate}%
                  </span>
                  <span className="text-muted-foreground ml-2">commission</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {AFFILIATE_TIERS.gold.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="landing-section py-16 md:py-24">
          <div className="landing-section-content">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Why Join Our Program?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to succeed as an affiliate
              </p>
            </div>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Recurring Commissions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Earn on every payment for 12 months, not just the first one.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Custom Vanity URL</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get a memorable link like kakamalem.com/yourname.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">90-Day Cookie</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get credit for referrals up to 90 days after the initial
                    click.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">No Minimum Payout</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Request a payout at any time, no minimum threshold required.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Real-Time Dashboard</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track clicks, signups, and commissions in real-time.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Instant Approval</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get approved instantly and start sharing your link right
                    away.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-section border-t bg-primary py-16 md:py-24">
          <div className="landing-section-content text-center">
            {isApprovedAffiliate ? (
              <>
                <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                  Welcome Back, Partner!
                </h2>
                <p className="mt-4 text-lg text-primary-foreground/90 max-w-2xl mx-auto">
                  Head to your dashboard to track your referrals and earnings.
                </p>
                <Button size="lg" variant="secondary" className="mt-8" asChild>
                  <Link href="/affiliate/dashboard">
                    <LayoutDashboard className="mr-2 size-4" />
                    Go to Dashboard
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                  Ready to Start Earning?
                </h2>
                <p className="mt-4 text-lg text-primary-foreground/90 max-w-2xl mx-auto">
                  Join our affiliate program today and start earning commissions
                  on every store you refer.
                </p>
                <Button size="lg" variant="secondary" className="mt-8" asChild>
                  <Link href="/become-affiliate">
                    Apply Now
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </>
            )}
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
                    href="/#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#pricing"
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
                    href="/affiliate"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Affiliate Program
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
