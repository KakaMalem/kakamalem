import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import {
  ArrowRight,
  Shield,
  Globe,
  Check,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Store,
} from "lucide-react";

/** USDT (Tether) logo — official green circle with ₮ mark */
function UsdtLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
        fill="white"
      />
    </svg>
  );
}

/**
 * Noise texture overlay — CSS-based SVG filter.
 * Creates a subtle film-grain effect over the gradient background.
 */
function NoiseOverlay() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.35] mix-blend-soft-light pointer-events-none">
      <filter id="noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  );
}

export default async function Home() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-teal-100 selection:text-teal-900 font-sans antialiased overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -left-40 w-200 h-200 rounded-full bg-linear-to-br from-teal-200/50 via-cyan-100/30 to-transparent blur-[100px]" />
        <div className="absolute -top-20 right-[-10%] w-150 h-150 rounded-full bg-linear-to-bl from-blue-200/40 via-sky-100/20 to-transparent blur-[80px]" />
        <div className="absolute top-[25vh] left-1/2 -translate-x-1/2 w-225 h-100 rounded-full bg-linear-to-b from-emerald-100/30 via-teal-50/20 to-transparent blur-[120px]" />

        {/* Accent glow near hero */}
        <div className="absolute top-[15vh] left-[15%] w-48 h-48 rounded-full bg-teal-400/10 blur-[60px]" />
        <div className="absolute top-[20vh] right-[10%] w-36 h-36 rounded-full bg-blue-400/10 blur-[50px]" />

        {/* Noise grain overlay */}
        <NoiseOverlay />

        {/* Floating USDT icons — decorative, hidden on mobile */}
        <div className="hidden md:block">
          <UsdtLogo className="absolute top-[12%] left-[8%] w-10 h-10 opacity-[0.07] -rotate-15" />
          <UsdtLogo className="absolute top-[22%] right-[7%] w-14 h-14 opacity-[0.05] rotate-10" />
          <UsdtLogo className="absolute top-[45%] left-[5%] w-8 h-8 opacity-[0.06] rotate-25" />
          <UsdtLogo className="absolute top-[55%] right-[12%] w-12 h-12 opacity-[0.04] -rotate-20" />
          <UsdtLogo className="absolute top-[75%] left-[15%] w-6 h-6 opacity-[0.06] rotate-35" />
          <UsdtLogo className="absolute top-[70%] right-[20%] w-9 h-9 opacity-[0.05] rotate-[-8deg]" />
        </div>

        {/* Bottom fade to white */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-white via-white/80 to-transparent" />
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
                <UsdtLogo className="h-3.5 w-3.5" />
                USDT
              </span>
              <span className="text-emerald-600/80">
                Crypto-native commerce. No banks required.
              </span>
            </div>

            {/* Headline */}
            <h1 className="max-w-225 text-[2.2rem] sm:text-[3rem] md:text-[4rem] lg:text-[5.2rem] font-extrabold tracking-[-0.04em] leading-[1.08] mb-5 sm:mb-6">
              <span className="text-zinc-950">Sell anywhere.</span>
              <br />
              <span className="bg-linear-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                Get paid in crypto.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-140 text-pretty text-[15px] sm:text-base md:text-[17px] text-zinc-500 leading-[1.75] mb-8 sm:mb-10 font-[425] px-2 sm:px-0">
              No bank account. No Stripe approval. No chargebacks. Kaka Malem
              gives you a storefront that accepts USDT, holds funds in escrow
              until delivery, and pays out to your wallet. Commerce without
              gatekeepers.
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
                <UsdtLogo className="h-5 w-5" />
                <span>
                  <span className="font-semibold text-zinc-800">USDT</span> on
                  TRC20
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-500" />
                <span>
                  <span className="font-semibold text-zinc-800">Escrow</span> on
                  every order
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber-500" />
                <span>
                  <span className="font-semibold text-zinc-800">No banks</span>{" "}
                  needed
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
                Wallet to wallet. Escrow in between.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                Your buyer sends USDT. Escrow holds it. You ship. Funds release
                to your wallet. No intermediary banks, no frozen accounts.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: UsdtLogo,
                  title: "Buyer sends USDT",
                  description:
                    "Customer picks a product and sends USDT (TRC20) to the escrow wallet. Payment confirms in seconds. No card networks, no bank wires, no waiting days for settlement.",
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  step: "02",
                  icon: Lock,
                  title: "Escrow holds the funds",
                  description:
                    "Funds are locked until you ship and delivery is confirmed. The buyer can see the payment is secured. You can see it's real. Neither side can pull out.",
                  color: "from-teal-500 to-emerald-500",
                },
                {
                  step: "03",
                  icon: CheckCircle2,
                  title: "You ship, funds release",
                  description:
                    "Upload tracking, ship the order. Once confirmed, USDT goes straight to your wallet minus a 5% fee. If no response in 30 days, auto-release.",
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
                Why crypto
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                The stuff banks won&apos;t let you do.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                Payment processors freeze accounts. Banks block cross-border
                transfers. Chargebacks drain sellers. Crypto fixes all of it.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
              {[
                {
                  icon: Shield,
                  title: "Zero chargebacks",
                  description:
                    "Crypto payments are final. No disputes filed with Visa. No PayPal holds. Once escrow releases, the money is yours. Period.",
                },
                {
                  icon: Globe,
                  title: "No borders, no banks",
                  description:
                    "Your buyer in Dubai, your supplier in Shenzhen, you in Kabul. USDT moves between wallets in seconds. No SWIFT, no correspondent banks, no 3-day holds.",
                },
                {
                  icon: ShieldCheck,
                  title: "Can't be shut down",
                  description:
                    "No payment processor can freeze your account or block your industry. Crypto doesn't ask for permission. Neither should your business.",
                },
                {
                  icon: Store,
                  title: "Real storefront, not just a wallet",
                  description:
                    "Full product catalog, images, variants, custom domain, analytics. A professional store your customers can browse — not a bare payment link.",
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
            <div className="relative mt-10 sm:mt-12 rounded-2xl border border-zinc-200 bg-linear-to-br from-zinc-900 to-zinc-800 p-6 sm:p-8 md:p-12 text-white overflow-hidden">
              {/* Decorative USDT watermark */}
              <UsdtLogo className="absolute -right-6 -bottom-6 w-40 h-40 opacity-[0.03]" />

              <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">
                    No subscriptions. No invoices. Just 5%.
                  </h3>
                  <p className="text-zinc-400 max-w-md text-[15px]">
                    Free to list, free to host. We take 5% when USDT releases
                    from escrow to your wallet. That&apos;s it. No card fees, no
                    gateway charges, no monthly bills.
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-4xl sm:text-5xl font-extrabold">
                      5%
                    </span>
                    <UsdtLogo className="h-8 w-8 sm:h-10 sm:w-10 opacity-80" />
                  </div>
                  <span className="text-sm text-zinc-500">
                    per escrow release. Nothing else.
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
                <UsdtLogo className="h-3.5 w-3.5" />
                Escrow Security
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Trustless doesn&apos;t mean unprotected.
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto text-[15px]">
                Crypto is irreversible by design. That&apos;s a feature, not a
                bug — but it means you need escrow. Neither side can rug the
                other.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
              {[
                {
                  icon: Lock,
                  title: "USDT locked until delivery",
                  description:
                    "Funds sit in a platform-controlled escrow wallet. Not in the seller's wallet, not in the buyer's. Nobody moves them until the deal is done.",
                },
                {
                  icon: Clock,
                  title: "30-day auto-release",
                  description:
                    "Shipped but buyer went silent? After 30 days, USDT auto-releases to the seller. No infinite limbo. No funds stuck forever.",
                },
                {
                  icon: AlertTriangle,
                  title: "Disputes resolved by humans",
                  description:
                    "Wrong item? Never arrived? Either side opens a dispute. Funds freeze. A Kaka Malem admin reviews evidence and releases to the rightful party.",
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
                Built for crypto. Not bolted on.
              </h2>
              <p className="text-zinc-500 text-[15px]">
                Other platforms treat crypto as an add-on. We built the entire
                system around it.
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

              {/* Decorative USDT icons */}
              <UsdtLogo className="absolute top-6 left-8 w-8 h-8 opacity-[0.06] -rotate-12" />
              <UsdtLogo className="absolute bottom-8 right-10 w-12 h-12 opacity-[0.05] rotate-15" />
              <UsdtLogo className="absolute top-1/2 left-4 w-6 h-6 opacity-[0.04] rotate-30 hidden md:block" />

              <div className="relative">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  Skip the bank. Start selling.
                </h2>
                <p className="text-zinc-400 max-w-md mx-auto mb-8 text-[15px]">
                  Create a store, list your products, share the link. Accept
                  USDT from anyone, anywhere. Withdraw to your wallet.
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
                  Crypto-native commerce platform. UK-registered, globally
                  accessible. USDT escrow for cross-border trade.
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
