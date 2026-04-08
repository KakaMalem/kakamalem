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
  Star,
  Zap,
  Shield,
  BarChart3,
  Link2,
} from "lucide-react";
import { AFFILIATE_TIERS, AFFILIATE_CONFIG } from "@/lib/affiliate/constants";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import Image from "next/image";

export const metadata = {
  title: "Affiliate Program | Kaka Malem",
  description:
    "Join the Kaka Malem affiliate program. Earn up to 50% commission for 12 months on every store you refer.",
};

const GridPattern = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
  >
    <defs>
      <pattern
        id="aff-grid"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 32 0 L 0 0 0 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#aff-grid)" />
  </svg>
);

export default async function AffiliateProgramPage() {
  const user = await getUser();

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

  const tiers = [
    {
      key: "bronze",
      data: AFFILIATE_TIERS.bronze,
      Icon: Award,
      gradient: "from-amber-500 to-orange-500",
      bg: "from-amber-50 to-orange-50",
      border: "border-amber-200/80",
      label: "Bronze",
    },
    {
      key: "silver",
      data: AFFILIATE_TIERS.silver,
      Icon: Award,
      gradient: "from-slate-400 to-slate-500",
      bg: "from-slate-50 to-zinc-50",
      border: "border-slate-300",
      label: "Silver",
      featured: true,
    },
    {
      key: "gold",
      data: AFFILIATE_TIERS.gold,
      Icon: Award,
      gradient: "from-yellow-400 to-amber-500",
      bg: "from-yellow-50 to-amber-50",
      border: "border-yellow-200/80",
      label: "Gold",
    },
  ];

  const benefits = [
    {
      icon: TrendingUp,
      title: "Recurring Commissions",
      desc: "Earn on every payment for 12 months, not just the first one.",
      gradient: "from-violet-500 to-purple-500",
      bg: "from-violet-50 to-purple-50",
    },
    {
      icon: Link2,
      title: "Custom Vanity URL",
      desc: "Get a memorable link like kakamalem.com/yourname.",
      gradient: "from-blue-500 to-cyan-500",
      bg: "from-blue-50 to-cyan-50",
    },
    {
      icon: Shield,
      title: `${AFFILIATE_CONFIG.cookieDurationDays}-Day Cookie`,
      desc: "Get credit for referrals up to 90 days after the initial click.",
      gradient: "from-emerald-500 to-teal-500",
      bg: "from-emerald-50 to-teal-50",
    },
    {
      icon: Wallet,
      title: "No Minimum Payout",
      desc: "Request a payout at any time, no minimum threshold required.",
      gradient: "from-sky-500 to-blue-500",
      bg: "from-sky-50 to-blue-50",
    },
    {
      icon: BarChart3,
      title: "Real-Time Dashboard",
      desc: "Track clicks, signups, and commissions in real-time.",
      gradient: "from-indigo-500 to-violet-500",
      bg: "from-indigo-50 to-violet-50",
    },
    {
      icon: Clock,
      title: "Instant Approval",
      desc: "Get approved instantly and start sharing your link right away.",
      gradient: "from-rose-500 to-pink-500",
      bg: "from-rose-50 to-pink-50",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-violet-100 selection:text-violet-900 font-sans antialiased overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <GridPattern className="absolute inset-0 text-zinc-200/50" />
        <div className="absolute -top-40 -left-40 w-175 h-175 rounded-full bg-linear-to-br from-violet-100 via-blue-50 to-transparent blur-[120px] opacity-60" />
        <div className="absolute -top-20 right-0 w-125 h-125 rounded-full bg-linear-to-bl from-amber-100 via-orange-50 to-transparent blur-[100px] opacity-50" />
      </div>

      <LandingNavbar
        user={user}
        links={[
          { label: "Home", href: "/" },
          { label: "How It Works", href: "#how-it-works" },
        ]}
      />

      <main className="flex flex-col items-center">
        {/* ── HERO ── */}
        <section className="relative w-full px-6 pt-32 pb-20 md:pt-44 md:pb-28 flex flex-col items-center text-center">
          <div className="relative max-w-4xl mx-auto flex flex-col items-center">
            {/* Badge */}
            <div className="group mb-10 inline-flex items-center gap-2.5 rounded-full border border-amber-200/80 bg-linear-to-r from-amber-50 to-orange-50 py-1.5 pl-2 pr-4 text-[13px] font-medium text-amber-700 shadow-sm shadow-amber-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200/60 py-0.5 px-2.5 text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                <Gift className="h-3 w-3" />
                Affiliate
              </span>
              <span className="text-amber-600/80">
                Earn up to {AFFILIATE_TIERS.gold.commissionRate}% recurring
                commission
              </span>
            </div>

            <h1 className="max-w-200 text-[2.8rem] sm:text-[3.5rem] md:text-[4.5rem] font-extrabold tracking-[-0.04em] leading-[1.05] mb-6">
              <span className="text-zinc-950">Partner with Kaka Malem.</span>
              <br />
              <span className="bg-linear-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Earn While You Share.
              </span>
            </h1>

            <p className="max-w-130 text-base md:text-[17px] text-zinc-500 leading-[1.75] mb-10">
              Help entrepreneurs launch their online stores and earn recurring
              commissions for {AFFILIATE_CONFIG.commissionDurationMonths} months
              on every successful referral.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
              {isApprovedAffiliate ? (
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all gap-2"
                  asChild
                >
                  <Link href="/affiliate/dashboard">
                    <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all gap-2"
                    asChild
                  >
                    <Link href="/become-affiliate">
                      Apply Now <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 border-zinc-200 bg-white/80 hover:bg-white hover:border-zinc-300"
                    asChild
                  >
                    <Link href="#how-it-works">Learn How It Works</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Trust dots */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
              {[
                `${AFFILIATE_CONFIG.cookieDurationDays}-day cookie`,
                `${AFFILIATE_CONFIG.commissionDurationMonths} months of commissions`,
                "No minimum payout",
              ].map((text) => (
                <span key={text} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="w-full border-y border-zinc-100 bg-linear-to-r from-zinc-50 via-white to-zinc-50 py-12">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-zinc-100 rounded-3xl overflow-hidden bg-zinc-100 shadow-sm">
              {[
                {
                  value: `${AFFILIATE_CONFIG.cookieDurationDays}`,
                  label: "Day Cookie",
                  color: "text-violet-600",
                },
                {
                  value: `${AFFILIATE_CONFIG.commissionDurationMonths}`,
                  label: "Months of Commissions",
                  color: "text-blue-600",
                },
                {
                  value: `${AFFILIATE_TIERS.gold.commissionRate}%`,
                  label: "Max Commission",
                  color: "text-amber-600",
                },
                {
                  value: "0 AFN",
                  label: "Minimum Payout",
                  color: "text-emerald-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white px-6 py-8 flex flex-col gap-1.5 hover:bg-zinc-50 transition-colors cursor-default"
                >
                  <span
                    className={`text-3xl md:text-4xl font-extrabold tracking-tight ${stat.color}`}
                  >
                    {stat.value}
                  </span>
                  <span className="text-sm text-zinc-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section
          id="how-it-works"
          className="w-full max-w-5xl px-4 py-20 md:py-28 scroll-mt-24"
        >
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-600 uppercase tracking-[0.2em] mb-4">
              <Zap className="h-3 w-3" /> How It Works
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-950 mb-3">
              Start earning in 3 simple steps.
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Apply, share your unique link, and earn on every subscription.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                step: "1",
                icon: Users,
                title: "Apply & Get Approved",
                desc: `Submit your application. Get approved instantly and receive your unique vanity URL (e.g., kakamalem.com/yourname).`,
                gradient: "from-violet-500 to-purple-500",
                bg: "from-violet-50 to-purple-50",
                border: "border-violet-100",
              },
              {
                step: "2",
                icon: TrendingUp,
                title: "Share Your Link",
                desc: `Share your unique link with your audience. Every visitor is tracked for ${AFFILIATE_CONFIG.cookieDurationDays} days with your cookie.`,
                gradient: "from-blue-500 to-cyan-500",
                bg: "from-blue-50 to-cyan-50",
                border: "border-blue-100",
              },
              {
                step: "3",
                icon: Wallet,
                title: "Earn Commissions",
                desc: `Earn a percentage on every subscription payment for ${AFFILIATE_CONFIG.commissionDurationMonths} months. No cap, no minimum.`,
                gradient: "from-emerald-500 to-teal-500",
                bg: "from-emerald-50 to-teal-50",
                border: "border-emerald-100",
              },
            ].map((s) => (
              <div
                key={s.step}
                className={`relative rounded-3xl border ${s.border} bg-linear-to-br ${s.bg} p-8 flex flex-col gap-5 hover:shadow-lg hover:scale-[1.01] transition-all duration-300`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br ${s.gradient} shadow-md`}
                  >
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <span
                    className={`text-4xl font-black bg-linear-to-br ${s.gradient} bg-clip-text text-transparent`}
                  >
                    {s.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">
                    {s.title}
                  </h3>
                  <p className="text-zinc-600 text-[15px] leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMMISSION TIERS ── */}
        <section
          id="tiers"
          className="w-full border-y border-zinc-100 bg-linear-to-b from-zinc-50 to-white py-20 md:py-28"
        >
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-4">
                <Award className="h-3 w-3" /> Commission Tiers
              </span>
              <h2 className="text-4xl font-extrabold tracking-tight text-zinc-950 mb-3">
                The more you refer, the more you earn.
              </h2>
              <p className="text-zinc-500 text-lg max-w-xl mx-auto">
                Unlock higher commission rates as you grow your referral
                network.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 pt-4">
              {tiers.map((tier) => (
                <div
                  key={tier.key}
                  className={`relative rounded-3xl border-2 ${
                    tier.featured
                      ? "border-violet-500 shadow-xl shadow-violet-100/50"
                      : tier.border
                  } bg-linear-to-br ${tier.bg} ${
                    tier.featured ? "pt-10 pb-8 px-8" : "p-8"
                  } flex flex-col gap-5 hover:scale-[1.01] transition-all duration-300`}
                >
                  {tier.featured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-violet-500 to-blue-500 px-5 py-1 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-md shadow-violet-500/30">
                      Most Popular
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div
                      className={`inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br ${tier.gradient} shadow-md`}
                    >
                      <tier.Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">
                        {tier.data.name}
                      </h3>
                      <p className="text-sm text-zinc-500">
                        {tier.data.maxReferrals
                          ? `${tier.data.minReferrals}–${tier.data.maxReferrals} referrals`
                          : `${tier.data.minReferrals}+ referrals`}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-end gap-1.5 mb-2">
                      <span className="text-5xl font-extrabold tracking-tight text-zinc-950">
                        {tier.data.commissionRate}%
                      </span>
                      <span className="text-zinc-500 font-medium pb-1">
                        commission
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {tier.data.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENEFITS ── */}
        <section className="w-full max-w-5xl px-4 py-20 md:py-28">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">
              <CheckCircle2 className="h-3 w-3" /> Benefits
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-950 mb-3">
              Why join our program?
            </h2>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Everything you need to succeed as an affiliate partner.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-3xl border border-zinc-100 bg-white p-7 flex gap-4 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 group"
              >
                <div
                  className={`inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br ${b.gradient} shadow-md shrink-0`}
                >
                  <b.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 mb-1.5">{b.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="relative w-full overflow-hidden py-24 md:py-36 px-4 flex flex-col items-center text-center bg-linear-to-b from-white via-violet-50/30 to-white">
          <div className="absolute inset-0 pointer-events-none">
            <GridPattern className="absolute inset-0 text-violet-200/30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-75 rounded-full bg-linear-to-b from-violet-100/60 to-transparent blur-[100px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            {isApprovedAffiliate ? (
              <>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[13px] font-medium text-emerald-600 shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
                  Welcome back, Partner!
                </div>
                <h2 className="text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-zinc-950 mb-6 max-w-2xl text-balance leading-[1.05]">
                  Ready to keep{" "}
                  <span className="bg-linear-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                    earning?
                  </span>
                </h2>
                <p className="text-zinc-500 text-lg mb-10 max-w-lg">
                  Head to your dashboard to track your referrals and earnings.
                </p>
                <Button
                  size="lg"
                  className="rounded-full px-8 h-12 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/30 gap-2"
                  asChild
                >
                  <Link href="/affiliate/dashboard">
                    <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[13px] font-medium text-violet-600 shadow-sm">
                  <Gift className="h-3.5 w-3.5" />
                  No application fee
                </div>
                <h2 className="text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-zinc-950 mb-6 max-w-2xl text-balance leading-[1.05]">
                  Start earning{" "}
                  <span className="bg-linear-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                    commissions
                  </span>{" "}
                  today.
                </h2>
                <p className="text-zinc-500 text-lg mb-10 max-w-lg">
                  Join our affiliate program and start earning commissions on
                  every store you refer.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/30 gap-2"
                    asChild
                  >
                    <Link href="/become-affiliate">
                      Apply Now <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 border-zinc-200 hover:border-zinc-300 bg-white"
                    asChild
                  >
                    <Link href="#how-it-works">Learn more</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-100 bg-zinc-950 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8 mb-12">
            <div className="col-span-2 flex flex-col gap-4">
              <Link href="/" className="flex items-center gap-2.5 w-fit">
                <Image
                  src="/icons/android-chrome-192x192.png"
                  alt="Kaka Malem"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                <span className="font-bold tracking-tight text-white">
                  Kaka Malem
                </span>
              </Link>
              <p className="text-[14px] text-zinc-500 max-w-xs leading-relaxed">
                The modern platform for building high-performance e-commerce
                experiences at scale.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: [
                  ["/#features", "Features"],
                  ["/#pricing", "Pricing"],
                  ["/affiliate", "Affiliates"],
                ],
              },
              {
                title: "Legal",
                links: [
                  ["/terms", "Terms of Service"],
                  ["/privacy", "Privacy Policy"],
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-zinc-300 mb-4 text-[13px] uppercase tracking-wider">
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.links.map(([href, label]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-[14px] text-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[13px] text-zinc-600">
              © {new Date().getFullYear()} Kaka Malem Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-[13px] text-emerald-500 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
