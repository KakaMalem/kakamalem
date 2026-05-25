import Link from "next/link";
import Image from "next/image";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import {
  ArrowRight,
  Check,
  Store,
  Package,
  ShoppingBag,
  BarChart3,
  CreditCard,
  Truck,
  Smartphone,
  Tag,
  Users,
  Layers,
  MessageSquareQuote,
  Mail,
  Building2,
} from "lucide-react";

/**
 * Subtle film-grain texture over the ambient gradients.
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

        {/* Accent glows near hero */}
        <div className="absolute top-[15vh] left-[15%] w-48 h-48 rounded-full bg-teal-400/10 blur-[60px]" />
        <div className="absolute top-[20vh] right-[10%] w-36 h-36 rounded-full bg-blue-400/10 blur-[50px]" />

        {/* Noise grain overlay */}
        <NoiseOverlay />

        {/* Bottom fade to white */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-white via-white/80 to-transparent" />
      </div>

      <LandingNavbar
        user={user}
        links={[
          { label: "How it works", href: "/#how-it-works" },
          { label: "Features", href: "/#features" },
          { label: "Pricing", href: "/#pricing" },
        ]}
      />

      <main className="flex flex-col items-center">
        {/* ============================================================
            HERO
        ============================================================ */}
        <section className="relative w-full px-5 sm:px-6 pt-28 pb-20 sm:pt-32 sm:pb-24 md:pt-40 md:pb-28">
          <div className="mx-auto max-w-6xl flex flex-col items-center text-center">
            <div className="mb-8 sm:mb-10 inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-linear-to-r from-emerald-50 to-blue-50 py-1.5 pl-2 pr-4 text-[13px] font-medium text-emerald-700 shadow-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200/60 py-0.5 px-2.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                AFN
              </span>
              <span className="text-emerald-600/80">
                Built for Afghan businesses
              </span>
            </div>

            <h1 className="max-w-4xl text-[2.2rem] sm:text-[3rem] md:text-[3.75rem] lg:text-[4.5rem] font-bold tracking-[-0.035em] leading-[1.05] mb-6">
              Your store, online,
              <br />
              <span className="bg-linear-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                in a single afternoon.
              </span>
            </h1>

            <p className="max-w-2xl text-base sm:text-lg text-zinc-600 leading-relaxed mb-10">
              Kaka Malem gives you a clean storefront, product catalog, online
              checkout, and order dashboard out of the box. Start with the free
              plan. Upgrade when you outgrow it.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-4 sm:px-0">
              <Button
                size="lg"
                className="group/btn rounded-full px-8 h-12 w-full sm:w-auto font-semibold text-[14px] tracking-[-0.01em] gap-2 bg-linear-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 border-0 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl transition-all duration-200"
                asChild
              >
                <Link href={user ? "/dashboard" : "/signup"}>
                  {user ? "Go to dashboard" : "Create your store"}
                  <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 h-12 w-full sm:w-auto font-medium text-[14px] tracking-[-0.01em] border-zinc-200 bg-white/80 backdrop-blur-sm text-zinc-600 hover:text-zinc-900 hover:bg-white hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200"
                asChild
              >
                <Link href="/#how-it-works">See how it works</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-zinc-500">
              No credit card. 7-day free trial.
            </p>
          </div>
        </section>

        {/* ============================================================
            HOW IT WORKS
        ============================================================ */}
        <section
          id="how-it-works"
          className="w-full px-5 sm:px-6 py-20 sm:py-24 md:py-28 border-t border-zinc-100/70"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Three steps from sign-up to first sale
              </h2>
              <p className="max-w-150 mx-auto text-zinc-600">
                The boring parts are already wired up. Pick a name, list a few
                products, and share the link.
              </p>
            </div>

            <ol className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Create your store",
                  body: "Pick a name, upload a logo, choose a theme color. Your storefront is live at kakamalem.com/store/your-name in under a minute.",
                  icon: Store,
                },
                {
                  step: "02",
                  title: "Add your products",
                  body: "Add products one at a time, or bulk-upload from a spreadsheet. Variants, photos, inventory, pricing — all in one place.",
                  icon: Package,
                },
                {
                  step: "03",
                  title: "Start selling",
                  body: "Accept card payments via HesabPay and cash on delivery. Track orders, manage stock, and watch the analytics roll in.",
                  icon: ShoppingBag,
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="relative rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-bold tracking-widest text-teal-600/80">
                      {item.step}
                    </span>
                    <span className="h-px flex-1 bg-linear-to-r from-teal-200 to-zinc-200" />
                    <item.icon className="size-4 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================================================
            FEATURES
        ============================================================ */}
        <section
          id="features"
          className="w-full px-5 sm:px-6 py-20 sm:py-24 md:py-28 border-t border-zinc-100/70"
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                Features
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[1.1] mb-5">
                Everything you need
                <br />
                <span className="bg-linear-to-r from-blue-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">
                  to run a store.
                </span>
              </h2>
              <p className="text-zinc-600 text-base sm:text-lg max-w-150">
                Built for the way Afghan businesses actually sell — online
                payments where they work, cash on delivery where they
                don&apos;t.
              </p>
            </div>

            {/* Two hero cards — payments + storefront */}
            <div className="grid gap-4 sm:gap-5 md:grid-cols-2 mb-4 sm:mb-5">
              {/* Payments hero */}
              <div className="relative rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-7 sm:p-8 overflow-hidden">
                <div className="absolute -top-10 -right-10 size-40 bg-emerald-100/60 rounded-full blur-3xl" />
                <div className="absolute -bottom-8 left-1/3 size-32 bg-teal-100/40 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-5">
                    Payments
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                    Get paid two ways
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                    Customers check out with HesabPay&apos;s hosted card flow,
                    or pick cash on delivery and pay the courier. Both are
                    tracked in the same orders dashboard.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-emerald-100/70 bg-emerald-50/30 p-3">
                      <CreditCard className="size-4 text-emerald-700 mb-2" />
                      <p className="text-xs font-semibold mb-0.5">HesabPay</p>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Cards, mobile money
                      </p>
                    </div>
                    <div className="rounded-lg border border-teal-100/70 bg-teal-50/30 p-3">
                      <Truck className="size-4 text-teal-700 mb-2" />
                      <p className="text-xs font-semibold mb-0.5">
                        Cash on Delivery
                      </p>
                      <p className="text-[11px] text-zinc-500 leading-tight">
                        Courier collects
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Storefront hero */}
              <div className="relative rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-7 sm:p-8 overflow-hidden">
                <div className="absolute -bottom-10 -left-10 size-40 bg-cyan-100/50 rounded-full blur-3xl" />
                <div className="absolute -top-6 -right-6 size-32 bg-teal-100/40 rounded-full blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/70 bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700 mb-5">
                    Storefront
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                    Looks good. Loads fast.
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                    Each store is a real storefront — your domain, your brand,
                    full product pages, cart, customer accounts. Mobile-first by
                    default, ranks on Google out of the box.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Custom domain",
                      "Free SSL",
                      "Mobile-first",
                      "SEO-ready",
                      "Multi-store",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Three-column row */}
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-3 mb-4 sm:mb-5">
              {[
                {
                  icon: Package,
                  title: "Products & inventory",
                  body: "Multi-variant products (size, color), stock tracking, bulk CSV import/export, low-stock alerts.",
                },
                {
                  icon: BarChart3,
                  title: "Analytics that matter",
                  body: "Revenue, top products, customer split, sales heatmaps by hour and weekday — without setup.",
                },
                {
                  icon: Smartphone,
                  title: "Offline POS",
                  body: "In-store sales drawn against the same inventory. Works without internet, syncs when back online.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-6 hover:border-teal-200 transition-colors"
                >
                  <f.icon className="size-5 text-teal-700 mb-4" />
                  <h3 className="text-base font-semibold mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Compact two-column row */}
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
              {[
                {
                  icon: Tag,
                  title: "Campaigns & promo codes",
                  body: "Scheduled sales, bulk pricing tiers, percentage and fixed-amount coupons, free-shipping thresholds.",
                },
                {
                  icon: Layers,
                  title: "Shipping zones",
                  body: "Flat, weight-based, or distance-based pricing. Per-zone delivery windows. Set it once.",
                },
                {
                  icon: Users,
                  title: "Customer accounts",
                  body: "Buyers save addresses, view order history, build wishlists. Repeat checkout is one click.",
                },
                {
                  icon: MessageSquareQuote,
                  title: "Reviews & ratings",
                  body: "Verified post-purchase reviews with photos. Reply publicly to any review.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-5 sm:p-6 hover:border-teal-200 transition-colors flex items-start gap-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-teal-50 to-cyan-50 border border-teal-100/60">
                    <f.icon className="size-4 text-teal-700" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold mb-1 tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            PRICING
        ============================================================ */}
        <section
          id="pricing"
          className="w-full px-5 sm:px-6 py-20 sm:py-24 md:py-28 border-t border-zinc-100/70"
        >
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                Pricing
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                One plan. Try it first.
              </h2>
              <p className="max-w-150 mx-auto text-zinc-600">
                Seven days of full access on us. Stay if it works for you,
                monthly or yearly. Cancel anytime.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
              {/* Trial */}
              <div className="rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-sm p-7 sm:p-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">7-day trial</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    Full access, no card required
                  </p>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight">0</span>
                  <span className="text-sm text-zinc-500">
                    AFN &middot; 7 days
                  </span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {[
                    "Everything in Pro",
                    "HesabPay + COD checkout",
                    "Custom storefront",
                    "Order management",
                    "Analytics dashboard",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-zinc-700"
                    >
                      <Check className="size-4 text-teal-600 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full w-full h-11 border-zinc-300"
                >
                  <Link href={user ? "/dashboard" : "/signup"}>
                    Start your trial
                  </Link>
                </Button>
              </div>

              {/* Pro */}
              <div className="rounded-2xl border-2 border-teal-900 bg-linear-to-br from-zinc-900 via-zinc-900 to-teal-950 text-white p-7 sm:p-8 flex flex-col relative shadow-xl shadow-teal-900/20">
                <span className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">Pro</h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    Built for growing stores
                  </p>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight">
                    1,100
                  </span>
                  <span className="text-sm text-zinc-400">AFN / month</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {[
                    "Unlimited products",
                    "Everything in Free",
                    "Custom domain",
                    "Offline POS",
                    "Priority support",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-zinc-200"
                    >
                      <Check className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="rounded-full w-full h-11 bg-white text-zinc-900 hover:bg-zinc-100"
                >
                  <Link href={user ? "/dashboard" : "/signup"}>
                    Start 7-day trial
                  </Link>
                </Button>
                <p className="text-xs text-zinc-500 text-center mt-3">
                  Also billed yearly. Cancel anytime.
                </p>
              </div>

              {/* Enterprise (coming soon) */}
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/40 backdrop-blur-sm p-7 sm:p-8 flex flex-col relative">
                <span className="absolute -top-3 right-6 rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  Coming soon
                </span>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-zinc-700">
                    Enterprise
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    For high-volume stores and teams
                  </p>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight text-zinc-700">
                    Custom
                  </span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {[
                    "Everything in Pro",
                    "Dedicated account manager",
                    "Custom integrations",
                    "Volume pricing",
                    "Uptime SLA",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-zinc-500"
                    >
                      <Check className="size-4 text-zinc-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  disabled
                  variant="outline"
                  className="rounded-full w-full h-11 border-dashed border-zinc-300 text-zinc-500"
                >
                  Coming soon
                </Button>
                <p className="text-xs text-zinc-400 text-center mt-3">
                  Want early access?{" "}
                  <a
                    href="mailto:hello@kakamalem.com"
                    className="underline underline-offset-2 hover:text-zinc-600"
                  >
                    Get in touch
                  </a>
                </p>
              </div>
            </div>

            <p className="text-center text-sm text-zinc-500 mt-8">
              Billed via HesabPay. Switch between monthly and yearly anytime.
            </p>
          </div>
        </section>

        {/* ============================================================
            FINAL CTA
        ============================================================ */}
        <section className="w-full px-5 sm:px-6 py-20 sm:py-24 md:py-28 border-t border-zinc-100/70">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-3xl border border-teal-200/60 bg-linear-to-br from-teal-50/80 via-cyan-50/60 to-emerald-50/40 backdrop-blur-sm p-10 sm:p-14 md:p-16 text-center mx-auto max-w-4xl">
              <div className="absolute -top-16 -left-16 size-56 rounded-full bg-teal-300/30 blur-3xl" />
              <div className="absolute -bottom-20 -right-16 size-64 rounded-full bg-cyan-300/30 blur-3xl" />
              <div className="relative">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Open your store today
                </h2>
                <p className="text-zinc-600 mb-8 max-w-150 mx-auto">
                  Start a 7-day free trial of Pro. No credit card. Your first
                  product listed in under five minutes.
                </p>
                <Button asChild size="lg" className="rounded-full px-7 h-12">
                  <Link href={user ? "/dashboard" : "/signup"}>
                    {user ? "Go to dashboard" : "Create your store"}
                    <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="border-t border-zinc-100 bg-zinc-950 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-10 gap-x-8 mb-12">
            {/* Brand */}
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
                A storefront builder for Afghan businesses. Open your store
                online, take orders, get paid.
              </p>
              <div className="flex flex-col gap-2 mt-1 text-[13px]">
                <a
                  href="mailto:hello@kakamalem.com"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <Mail className="size-3.5" />
                  hello@kakamalem.com
                </a>
                <a
                  href="https://find-and-update.company-information.service.gov.uk/company/17054971"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <Building2 className="size-3.5" />
                  UK Ltd &middot; #17054971
                </a>
              </div>
            </div>
            {[
              {
                title: "Product",
                links: [
                  ["/#features", "Features"],
                  ["/#how-it-works", "How it works"],
                  ["/#pricing", "Pricing"],
                  [
                    user ? "/dashboard" : "/signup",
                    user ? "Dashboard" : "Sign up",
                  ],
                ] as [string, string][],
              },
              {
                title: "Company",
                links: [
                  ["/become-affiliate", "Affiliate program"],
                  ["mailto:hello@kakamalem.com", "Contact"],
                  [
                    "mailto:hello@kakamalem.com?subject=Enterprise%20inquiry",
                    "Enterprise",
                  ],
                ] as [string, string][],
              },
              {
                title: "Legal",
                links: [
                  ["/privacy", "Privacy Policy"],
                  ["/terms", "Terms of Service"],
                  ["/data-deletion", "Data deletion"],
                ] as [string, string][],
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
