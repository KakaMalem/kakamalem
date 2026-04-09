import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import {
  ArrowRight,
  Shield,
  Globe,
  Package,
  Check,
  Zap,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Users,
  ShieldCheck,
  Link2,
  Store,
} from "lucide-react";

const GridPattern = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
  >
    <defs>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path
          d="M 32 0 L 0 0 0 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

export default async function Home() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-teal-100 selection:text-teal-900 font-sans antialiased overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <GridPattern className="absolute inset-0 text-zinc-200/60" />
        <div className="absolute -top-40 -left-40 w-175 h-175 rounded-full bg-linear-to-br from-teal-100 via-blue-50 to-transparent blur-[120px] opacity-70" />
        <div className="absolute -top-20 right-0 w-125 h-125 rounded-full bg-linear-to-bl from-sky-100 via-cyan-50 to-transparent blur-[100px] opacity-60" />
        <div className="absolute top-[30vh] left-1/2 -translate-x-1/2 w-200 h-100 rounded-full bg-linear-to-b from-blue-50 to-transparent blur-[140px] opacity-50" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-white to-transparent" />
      </div>

      <LandingNavbar
        user={user}
        links={[
          { label: "How it works", href: "/#how-it-works" },
          { label: "Features", href: "/#features" },
          { label: "Security", href: "/#security" },
        ]}
      />

      <main className="flex flex-col items-center">
        {/* ============================================================
            1. HERO
        ============================================================ */}
        <section className="relative w-full px-5 sm:px-6 pt-28 pb-16 sm:pt-32 sm:pb-20 md:pt-44 md:pb-28 flex flex-col items-center text-center">
          <div className="relative max-w-5xl mx-auto flex flex-col items-center">
            {/* Badge */}
            <div className="mb-8 sm:mb-10 inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-linear-to-r from-emerald-50 to-blue-50 py-1.5 pl-2 pr-4 text-[13px] font-medium text-emerald-700 shadow-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200/60 py-0.5 px-2.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                <Shield className="h-3 w-3" />
                Escrow
              </span>
              <span className="text-emerald-600/80">
                Crypto-protected payments built in
              </span>
            </div>

            {/* Headline */}
            <h1 className="max-w-225 text-[2.2rem] sm:text-[3rem] md:text-[4rem] lg:text-[5.2rem] font-extrabold tracking-[-0.04em] leading-[1.08] mb-5 sm:mb-6">
              <span className="text-zinc-950">Build your store.</span>
              <br />
              <span className="bg-linear-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                Send a link. Get paid.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-140 text-pretty text-[15px] sm:text-base md:text-[17px] text-zinc-500 leading-[1.75] mb-8 sm:mb-10 font-[425] px-2 sm:px-0">
              Kaka Malem lets you create a professional online store in minutes
              and share it with customers anywhere. Payments are held in crypto
              escrow until delivery is confirmed. No banks needed.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-10 sm:mb-12 w-full sm:w-auto px-4 sm:px-0">
              <Button
                size="lg"
                className="group/btn rounded-full px-8 h-12 w-full sm:w-auto font-semibold text-[14px] tracking-[-0.01em] gap-2 bg-linear-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 border-0 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl transition-all duration-200"
                asChild
              >
                <Link href={user ? "/dashboard" : "/signup"}>
                  {user ? "Go to Dashboard" : "Create your store"}
                  <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 h-12 w-full sm:w-auto font-medium text-[14px] tracking-[-0.01em] border-zinc-200 bg-white/80 backdrop-blur-sm text-zinc-600 hover:text-zinc-900 hover:bg-white hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200"
                asChild
              >
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>

            {/* Trust stats */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-500" />
                <span>
                  <span className="font-semibold text-zinc-800">100%</span>{" "}
                  escrow protected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                <span>
                  Pay with{" "}
                  <span className="font-semibold text-zinc-800">USDT</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>
                  <span className="font-semibold text-zinc-800">Free</span> to
                  start
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            2. HOW IT WORKS
        ============================================================ */}
        <section
          id="how-it-works"
          className="w-full border-y border-zinc-100 bg-linear-to-b from-zinc-50 to-white py-16 sm:py-20 md:py-28"
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-12 sm:mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-4">
                How it works
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Three steps. Zero trust required.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                Create your store, share the link, and let escrow handle the
                trust.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: Store,
                  title: "Create your store",
                  description:
                    "Sign up for free and set up your store in minutes. Add products with images, variants, and pricing. Get a shareable store link instantly.",
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  step: "02",
                  icon: Link2,
                  title: "Share with customers",
                  description:
                    "Send your store link to customers anywhere. They browse your catalog and pay in USDT. Funds are locked in escrow until delivery.",
                  color: "from-teal-500 to-emerald-500",
                },
                {
                  step: "03",
                  icon: CheckCircle2,
                  title: "Deliver and get paid",
                  description:
                    "Ship the order and upload tracking. Once delivery is confirmed, funds release to you minus a 5% fee. Auto-release after 30 days.",
                  color: "from-emerald-500 to-green-500",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    className={`mb-5 sm:mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${item.color} text-white shadow-lg`}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                    Step {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                  <p className="text-[15px] text-zinc-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Dispute callout */}
            <div className="mt-10 sm:mt-12 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">
                  Something wrong? Open a dispute.
                </h4>
                <p className="text-[15px] text-zinc-600 leading-relaxed">
                  If the product doesn&apos;t match, is damaged, or never
                  arrives — open a dispute. Funds are frozen immediately and a
                  Kaka Malem admin reviews the evidence from both sides. The
                  winner gets the funds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            3. FEATURES
        ============================================================ */}
        <section id="features" className="w-full py-16 sm:py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-12 sm:mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">
                Features
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Everything you need to sell online.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                A full-featured store builder with crypto payments and escrow
                protection baked in. No monthly fees — pay only when you earn.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
              {[
                {
                  icon: Package,
                  title: "Full product catalog",
                  description:
                    "Add unlimited products with variants, images, categories, and bulk import. Your brand, your store.",
                },
                {
                  icon: Shield,
                  title: "Built-in escrow protection",
                  description:
                    "No chargebacks, no payment reversals. Once delivery is confirmed, funds are yours. Period.",
                },
                {
                  icon: Globe,
                  title: "Sell to anyone, anywhere",
                  description:
                    "Share your store link with customers in any country. They pay in USDT and you receive crypto to your wallet.",
                },
                {
                  icon: Users,
                  title: "Customer management",
                  description:
                    "Track orders, manage customer groups, run promotions, and build loyalty with your buyers over time.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                    <feature.icon className="h-5 w-5 text-zinc-700" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[15px] text-zinc-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Pricing simple */}
            <div className="mt-10 sm:mt-12 rounded-2xl border border-zinc-200 bg-linear-to-br from-zinc-900 to-zinc-800 p-6 sm:p-8 md:p-12 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">
                    Simple pricing. No surprises.
                  </h3>
                  <p className="text-zinc-400 max-w-md text-[15px]">
                    Free to sign up. Free to list. We take a flat 5% fee only
                    when escrow releases payment to you.
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold">
                      5%
                    </span>
                    <span className="text-zinc-400 text-base sm:text-lg">
                      per release
                    </span>
                  </div>
                  <span className="text-sm text-zinc-500">
                    No hidden fees. No monthly charges.
                  </span>
                </div>
              </div>
              <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-3 sm:gap-6">
                {[
                  "Free to list products",
                  "Free storefront",
                  "Unlimited products",
                  "Custom domain support",
                  "Bulk import/export",
                  "Analytics dashboard",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-[13px] sm:text-[14px] text-zinc-300"
                  >
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            4. SECURITY / TRUST
        ============================================================ */}
        <section
          id="security"
          className="w-full border-y border-zinc-100 bg-linear-to-b from-zinc-50 to-white py-16 sm:py-20 md:py-28"
        >
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-12 sm:mb-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-4">
                <Lock className="h-3 w-3" />
                Security
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Your money is safe. Always.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                Escrow means neither party can run with the money. Every
                transaction is protected from payment to delivery.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
              {[
                {
                  icon: Lock,
                  title: "Funds locked in escrow",
                  description:
                    "Crypto payments go to a platform-controlled escrow wallet. Nobody can withdraw until delivery is confirmed or a dispute is resolved.",
                },
                {
                  icon: Clock,
                  title: "30-day auto-release",
                  description:
                    "If the buyer doesn't respond within 30 days after shipping, funds automatically release to the seller. No infinite limbo.",
                },
                {
                  icon: ShieldCheck,
                  title: "Admin dispute resolution",
                  description:
                    "Both parties can submit evidence. A Kaka Malem admin reviews the case and releases funds to the rightful party.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8 shadow-sm"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <item.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-[15px] text-zinc-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            5. WHY US / COMPARISON
        ============================================================ */}
        <section className="w-full py-16 sm:py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-10 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Why Kaka Malem?
              </h2>
              <p className="text-zinc-500 text-[15px]">
                Traditional platforms weren&apos;t built for crypto-native
                commerce.
              </p>
            </div>

            {/* Mobile: card-based comparison */}
            <div className="block sm:hidden space-y-3">
              {[
                {
                  feature: "Crypto payments",
                  us: true,
                  shopify: false,
                  alibaba: false,
                },
                {
                  feature: "Built-in escrow",
                  us: true,
                  shopify: false,
                  alibaba: true,
                },
                {
                  feature: "No bank account needed",
                  us: true,
                  shopify: false,
                  alibaba: false,
                },
                {
                  feature: "No monthly fees",
                  us: true,
                  shopify: false,
                  alibaba: true,
                },
                {
                  feature: "Censorship resistant",
                  us: true,
                  shopify: false,
                  alibaba: false,
                },
                {
                  feature: "Retail buyer friendly",
                  us: true,
                  shopify: true,
                  alibaba: false,
                },
                {
                  feature: "Dispute resolution",
                  us: true,
                  shopify: false,
                  alibaba: true,
                },
              ].map((row) => (
                <div
                  key={row.feature}
                  className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-zinc-800 mb-3 text-[15px]">
                    {row.feature}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-teal-50 border border-teal-100 py-2">
                      <p className="font-semibold text-teal-700 mb-0.5">
                        Kaka Malem
                      </p>
                      {row.us ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </div>
                    <div className="rounded-lg bg-zinc-50 py-2">
                      <p className="font-medium text-zinc-500 mb-0.5">
                        Shopify
                      </p>
                      {row.shopify ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </div>
                    <div className="rounded-lg bg-zinc-50 py-2">
                      <p className="font-medium text-zinc-500 mb-0.5">
                        Alibaba
                      </p>
                      {row.alibaba ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table comparison */}
            <div className="hidden sm:block overflow-hidden rounded-2xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="p-4 text-left font-semibold text-zinc-900">
                      Feature
                    </th>
                    <th className="p-4 text-center font-semibold text-teal-700 bg-teal-50/50">
                      Kaka Malem
                    </th>
                    <th className="p-4 text-center font-medium text-zinc-500">
                      Shopify
                    </th>
                    <th className="p-4 text-center font-medium text-zinc-500">
                      Alibaba
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[
                    {
                      feature: "Crypto payments",
                      us: true,
                      shopify: false,
                      alibaba: false,
                    },
                    {
                      feature: "Built-in escrow",
                      us: true,
                      shopify: false,
                      alibaba: true,
                    },
                    {
                      feature: "No bank account needed",
                      us: true,
                      shopify: false,
                      alibaba: false,
                    },
                    {
                      feature: "No monthly fees",
                      us: true,
                      shopify: false,
                      alibaba: true,
                    },
                    {
                      feature: "Censorship resistant",
                      us: true,
                      shopify: false,
                      alibaba: false,
                    },
                    {
                      feature: "Retail buyer friendly",
                      us: true,
                      shopify: true,
                      alibaba: false,
                    },
                    {
                      feature: "Dispute resolution",
                      us: true,
                      shopify: false,
                      alibaba: true,
                    },
                  ].map((row) => (
                    <tr key={row.feature} className="hover:bg-zinc-50/50">
                      <td className="p-4 font-medium text-zinc-700">
                        {row.feature}
                      </td>
                      <td className="p-4 text-center bg-teal-50/30">
                        {row.us ? (
                          <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.shopify ? (
                          <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.alibaba ? (
                          <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ============================================================
            6. FINAL CTA
        ============================================================ */}
        <section className="w-full py-16 sm:py-20 md:py-28">
          <div className="max-w-4xl mx-auto px-5 sm:px-6">
            <div className="relative rounded-3xl bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 sm:p-10 md:p-16 text-center overflow-hidden">
              {/* Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-75 bg-linear-to-b from-teal-500/20 to-transparent blur-[100px] -translate-y-1/2" />

              <div className="relative">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to start selling?
                </h2>
                <p className="text-zinc-400 max-w-md mx-auto mb-8 text-[15px]">
                  Create your store for free, add your products, and share the
                  link with customers. Your first sale could be today.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4 sm:px-0">
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 w-full sm:w-auto font-semibold text-[14px] gap-2 bg-white text-zinc-900 hover:bg-zinc-100 shadow-lg transition-all"
                    asChild
                  >
                    <Link href={user ? "/dashboard" : "/signup"}>
                      {user ? "Go to Dashboard" : "Create your store"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 w-full sm:w-auto font-medium text-[14px] border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400 hover:bg-zinc-800 bg-transparent transition-all duration-200"
                    asChild
                  >
                    <Link href="#how-it-works">Learn more</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            7. FOOTER
        ============================================================ */}
        <footer className="w-full border-t border-zinc-100 bg-zinc-950 text-zinc-400 py-10 sm:py-12 md:py-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-10">
              {/* Brand */}
              <div className="max-w-xs">
                <Link href="/" className="flex items-center gap-2 mb-3 group">
                  <span className="font-bold tracking-tight text-white">
                    Kaka Malem
                  </span>
                </Link>
                <p className="text-[14px] leading-relaxed">
                  UK-based. Build your store, share a link, get paid with crypto
                  escrow.
                </p>
              </div>

              {/* Links */}
              <div className="grid grid-cols-2 gap-x-16 gap-y-6">
                <div>
                  <h4 className="text-[12px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                    Platform
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    <Link
                      href="#how-it-works"
                      className="text-[14px] hover:text-white transition-colors"
                    >
                      How it works
                    </Link>
                    <Link
                      href="#features"
                      className="text-[14px] hover:text-white transition-colors"
                    >
                      Features
                    </Link>
                    <Link
                      href="#security"
                      className="text-[14px] hover:text-white transition-colors"
                    >
                      Security
                    </Link>
                  </div>
                </div>
                <div>
                  <h4 className="text-[12px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                    Legal
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    <Link
                      href="/terms"
                      className="text-[14px] hover:text-white transition-colors"
                    >
                      Terms of Service
                    </Link>
                    <Link
                      href="/privacy"
                      className="text-[14px] hover:text-white transition-colors"
                    >
                      Privacy Policy
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[13px]">
                &copy; {new Date().getFullYear()} Kaka Malem Ltd. All rights
                reserved.
              </p>
              <a
                href="https://find-and-update.company-information.service.gov.uk/company/17054971"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                UK Registered Company
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
