import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Shield,
  BarChart2,
  Globe,
  Package,
  Truck,
  CreditCard,
  Check,
  Star,
  Plug,
  Zap,
  ShoppingBag,
  Bot,
  ShoppingCart,
  MessageSquare,
  BarChart3,
} from "lucide-react";

// â”€â”€ Inline SVG grid pattern â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

const DotPattern = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
  >
    <defs>
      <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)" />
  </svg>
);

export default async function Home() {
  const user = await getUser();

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-violet-100 selection:text-violet-900 font-sans antialiased overflow-x-hidden">
      {/* â”€â”€ Ambient Background â”€â”€ */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <GridPattern className="absolute inset-0 text-zinc-200/60" />
        {/* Top-left warm blob */}
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-linear-to-br from-violet-100 via-blue-50 to-transparent blur-[120px] opacity-70" />
        {/* Top-right cool blob */}
        <div className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full bg-linear-to-bl from-sky-100 via-indigo-50 to-transparent blur-[100px] opacity-60" />
        {/* Center glow */}
        <div className="absolute top-[30vh] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-linear-to-b from-violet-50 to-transparent blur-[140px] opacity-50" />
        {/* Fade to white at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-white to-transparent" />
      </div>

      <LandingNavbar user={user} />

      <main className="flex flex-col items-center">
        {/* 
            1. HERO
             */}
        <section className="relative w-full px-6 pt-32 pb-20 md:pt-44 md:pb-28 flex flex-col items-center text-center">
          {/* â”€â”€ Content â”€â”€ */}
          <div className="relative max-w-5xl mx-auto flex flex-col items-center">
            {/* Badge */}
            <a
              href="#features"
              className="group mb-10 inline-flex items-center gap-2.5 rounded-full border border-violet-200/80 bg-linear-to-r from-violet-50 to-blue-50 backdrop-blur-sm py-1.5 pl-2 pr-4 text-[13px] font-medium text-violet-700 shadow-sm shadow-violet-100 transition-all duration-300 hover:border-violet-300 hover:shadow-violet-200/50 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 border border-violet-200/60 py-0.5 px-2.5 text-[11px] font-semibold text-violet-700 uppercase tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
                </span>
                Beta
              </span>
              <span className="text-violet-600/80 group-hover:text-violet-800 transition-colors duration-200">
                Now in public beta — read the announcement
              </span>
              <ArrowRight className="h-3 w-3 text-violet-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-200" />
            </a>

            {/* Headline */}
            <h1 className="max-w-[900px] text-[2.8rem] sm:text-[3.5rem] md:text-[4.5rem] lg:text-[5.2rem] font-extrabold tracking-[-0.04em] leading-[1.05] mb-6">
              <span className="text-zinc-950">Build your store at</span>
              <br />
              <span className="relative">
                <span className="bg-linear-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  the speed of thought.
                </span>
                {/* Underline glow */}
                <span className="absolute -bottom-1 left-0 right-0 h-px bg-linear-to-r from-violet-400/0 via-blue-400/60 to-cyan-400/0" />
              </span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-[520px] text-pretty text-base md:text-[17px] text-zinc-500 leading-[1.75] mb-10 font-[425]">
              Kaka Malem is the modern commerce platform for the next generation
              of merchants — from first product to global scale.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-12">
              <Button
                size="lg"
                className="group/btn rounded-full px-8 h-12 font-semibold text-[14px] tracking-[-0.01em] gap-2 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:shadow-xl transition-all duration-200"
                asChild
              >
                <Link href={user ? "/dashboard" : "/signup"}>
                  {user ? "Enter Dashboard" : "Start for free"}
                  <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 h-12 font-medium text-[14px] tracking-[-0.01em] border-zinc-200 bg-white/80 backdrop-blur-sm text-zinc-600 hover:text-zinc-900 hover:bg-white hover:border-zinc-300 shadow-sm hover:shadow-md transition-all duration-200"
                asChild
              >
                <Link href="#features">Explore features</Link>
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              {/* Avatar stack */}
              <div className="flex -space-x-2.5">
                {[
                  { bg: "from-rose-400 to-pink-500", initial: "A" },
                  { bg: "from-blue-400 to-indigo-500", initial: "S" },
                  { bg: "from-emerald-400 to-teal-500", initial: "M" },
                  { bg: "from-violet-400 to-purple-500", initial: "R" },
                  { bg: "from-amber-400 to-orange-500", initial: "K" },
                ].map((avatar, i) => (
                  <div
                    key={i}
                    className={`h-9 w-9 rounded-full ring-[2.5px] ring-white bg-linear-to-br ${avatar.bg} flex items-center justify-center text-[11px] text-white font-bold shadow-sm`}
                  >
                    {avatar.initial}
                  </div>
                ))}
              </div>

              <div className="hidden sm:block h-8 w-px bg-zinc-200" />

              <div className="flex flex-col items-center sm:items-start gap-1">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                    />
                  ))}
                  <span className="ml-1.5 text-[13px] font-semibold text-zinc-800">
                    4.9
                  </span>
                </div>
                <p className="text-[13px] text-zinc-500 font-medium">
                  Trusted by{" "}
                  <span className="text-zinc-800 font-semibold">1,200+</span>{" "}
                  merchants worldwide
                </p>
              </div>
            </div>
          </div>

          {/* Connector line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-px h-16 bg-linear-to-b from-transparent via-violet-200 to-violet-300" />
            <div className="h-1.5 w-1.5 rounded-full bg-violet-300 -mt-px" />
          </div>
        </section>

        {/* 
            2. LOGO STRIP
             */}
        <section className="w-full border-y border-zinc-100 bg-linear-to-r from-zinc-50 via-white to-zinc-50 py-10">
          <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-8">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.25em]">
              Empowering 1,200+ merchants with
            </p>
            <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
              {[
                "AliExpress",
                "Amazon",
                "AutoDS",
                "Shopify",
                "HesabPay",
                "Stripe",
              ].map((name) => (
                <span
                  key={name}
                  className="text-xl font-bold tracking-tight text-zinc-200 hover:text-zinc-500 transition-colors cursor-default duration-300"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 
            3. STATS
             */}
        <section className="w-full max-w-5xl px-4 py-20 md:py-28">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px border border-zinc-100 rounded-3xl overflow-hidden bg-zinc-100 shadow-sm">
            {[
              {
                value: "1.2K+",
                label: "Active merchants",
                color: "text-violet-600",
              },
              {
                value: "50ms",
                label: "Avg. response time",
                color: "text-blue-600",
              },
              {
                value: "99.9%",
                label: "Uptime SLA",
                color: "text-emerald-600",
              },
              { value: "$0", label: "To get started", color: "text-amber-600" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white px-8 py-10 flex flex-col gap-1.5 hover:bg-linear-to-br hover:from-zinc-50 hover:to-white transition-all group cursor-default"
              >
                <span
                  className={`text-3xl md:text-4xl font-extrabold tracking-tight ${stat.color} group-hover:scale-105 transition-transform duration-200 inline-block`}
                >
                  {stat.value}
                </span>
                <span className="text-sm text-zinc-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 
            4. FEATURES
             */}
        <section
          id="features"
          className="w-full max-w-6xl px-4 pb-8 scroll-mt-24"
        >
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-600 uppercase tracking-[0.2em] mb-4">
              <Zap className="h-3 w-3" /> Platform
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950 mb-4">
              Everything you need to sell.
            </h2>
            <p className="text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed">
              One platform that handles products, orders, payments and analytics
              — so you can focus on growing.
            </p>
          </div>

          {/* Row 1 */}
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            {/* Product Management — large card */}
            <div className="relative rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-violet-50/40 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-violet-100/50 transition-all duration-300 group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-violet-50/30 via-transparent to-blue-50/20 pointer-events-none" />
              <div className="p-8 md:p-10">
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-violet-500 to-blue-500 shadow-md shadow-violet-200 mb-6">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                  Product Management
                </h3>
                <p className="text-zinc-500 text-[15px] leading-relaxed max-w-xs">
                  Import from AliExpress, Amazon & AutoDS in one click. Bulk
                  edit prices, variants, and descriptions with AI.
                </p>
              </div>
              {/* Visual */}
              <div className="relative h-auto sm:h-52 mx-4 sm:mx-6 mb-6 rounded-2xl border border-violet-100/80 bg-linear-to-br from-violet-50 to-blue-50 overflow-hidden">
                <DotPattern className="absolute inset-0 text-violet-200/50" />
                <div className="relative z-10 grid grid-cols-2 sm:flex sm:flex-nowrap items-center justify-center gap-2.5 sm:gap-3 p-4 sm:p-6 h-full w-full">
                  {[
                    {
                      name: "AliExpress",
                      bg: "from-orange-50 to-rose-50",
                      border: "border-orange-200/80",
                      Icon: ShoppingBag,
                      color: "text-orange-500",
                      shadow: "shadow-orange-100",
                    },
                    {
                      name: "Amazon",
                      bg: "from-amber-50 to-yellow-50",
                      border: "border-amber-200/80",
                      Icon: Package,
                      color: "text-amber-500",
                      shadow: "shadow-amber-100",
                    },
                    {
                      name: "AutoDS",
                      bg: "from-blue-50 to-indigo-50",
                      border: "border-blue-200/80",
                      Icon: Bot,
                      color: "text-blue-500",
                      shadow: "shadow-blue-100",
                    },
                    {
                      name: "Shopify",
                      bg: "from-emerald-50 to-teal-50",
                      border: "border-emerald-200/80",
                      Icon: ShoppingCart,
                      color: "text-emerald-500",
                      shadow: "shadow-emerald-100",
                    },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className={`flex flex-col items-center gap-2 rounded-2xl border ${item.border} bg-linear-to-br ${item.bg} px-4 py-3 shadow-sm ${item.shadow} text-xs font-semibold text-zinc-700 hover:scale-105 transition-transform duration-200 cursor-default`}
                    >
                      <item.Icon className={`h-6 w-6 ${item.color}`} />
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column — small cards */}
            <div className="flex flex-col gap-5">
              {/* Auto Fulfillment */}
              <div className="relative rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-blue-50/30 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 p-8 group">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-blue-50/30 to-transparent pointer-events-none" />
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-200 mb-4">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                  Auto Fulfillment
                </h3>
                <p className="text-zinc-500 text-[15px] leading-relaxed">
                  Orders are automatically routed to suppliers and tracking
                  numbers synced back in real-time.
                </p>
                <div className="mt-5 rounded-xl border border-zinc-100 bg-white divide-y divide-zinc-50 overflow-hidden shadow-sm">
                  {[
                    {
                      label: "Order #3821",
                      status: "Fulfilled",
                      color:
                        "text-emerald-700 bg-emerald-50 border border-emerald-200/60",
                    },
                    {
                      label: "Order #3820",
                      status: "Shipping",
                      color:
                        "text-blue-700 bg-blue-50 border border-blue-200/60",
                    },
                    {
                      label: "Order #3819",
                      status: "Processing",
                      color:
                        "text-amber-700 bg-amber-50 border border-amber-200/60",
                    },
                  ].map((o) => (
                    <div
                      key={o.label}
                      className="flex items-center justify-between px-4 py-2.5 text-[13px]"
                    >
                      <span className="font-medium text-zinc-700">
                        {o.label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${o.color}`}
                      >
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments */}
              <div className="relative rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-emerald-50/30 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-emerald-100/40 transition-all duration-300 p-8 group">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-emerald-50/30 to-transparent pointer-events-none" />
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-200 mb-4">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                  Payments Built In
                </h3>
                <p className="text-zinc-500 text-[15px] leading-relaxed">
                  Accept payments globally with zero setup — Stripe, PayPal, and
                  local gateways out of the box.
                </p>
              </div>
            </div>
          </div>

          {/* Row 2 — three cards */}
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Global Edge */}
            <div className="relative h-full rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-indigo-50/30 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-indigo-100/40 transition-all duration-300 p-8 flex flex-col group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-indigo-50/30 to-transparent pointer-events-none" />
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-200 mb-4">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                Global Edge
              </h3>
              <p className="text-zinc-500 text-[15px] leading-relaxed flex-1">
                Every storefront deployed to 30+ edge regions. Sub-50ms load
                times, anywhere on the planet.
              </p>
              <div className="mt-5 h-52 rounded-2xl border border-indigo-100/60 bg-linear-to-br from-indigo-50 to-violet-50 overflow-hidden relative flex items-center justify-center">
                <DotPattern className="absolute inset-0 text-indigo-200/50" />
                <Globe className="relative h-12 w-12 text-indigo-200" />
                {[
                  { top: "30%", left: "20%" },
                  { top: "55%", left: "52%" },
                  { top: "35%", left: "72%" },
                ].map((pos, i) => (
                  <span
                    key={i}
                    className="absolute flex h-2.5 w-2.5"
                    style={{ top: pos.top, left: pos.left }}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                  </span>
                ))}
              </div>
            </div>

            {/* Live Analytics */}
            <div className="relative h-full rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-sky-50/30 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-sky-100/40 transition-all duration-300 p-8 flex flex-col group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-sky-50/30 to-transparent pointer-events-none" />
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-sky-500 to-blue-500 shadow-md shadow-sky-200 mb-4">
                <BarChart2 className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                Live Analytics
              </h3>
              <p className="text-zinc-500 text-[15px] leading-relaxed flex-1">
                Revenue, conversion, and traffic — all in one real-time
                dashboard. No setup required.
              </p>
              <div className="mt-5 h-52 rounded-2xl border border-sky-100/60 bg-linear-to-br from-sky-50 to-blue-50 px-3 pb-0 overflow-hidden relative flex items-end gap-1">
                {[30, 55, 40, 70, 50, 85, 60, 95, 75, 100, 80, 90].map(
                  (v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm transition-colors"
                      style={{
                        height: `${v * 0.75}%`,
                        background: `linear-gradient(to top, rgba(14,165,233,${0.3 + v / 200}), rgba(99,102,241,${0.2 + v / 300}))`,
                      }}
                    />
                  )
                )}
              </div>
            </div>

            {/* Integrations */}
            <div className="relative h-full rounded-3xl border border-zinc-100 bg-linear-to-br from-white to-rose-50/20 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-rose-100/30 transition-all duration-300 p-8 flex flex-col group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-br from-rose-50/20 to-transparent pointer-events-none" />
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-rose-500 to-orange-500 shadow-md shadow-rose-200 mb-4">
                <Plug className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                Integrations
              </h3>
              <p className="text-zinc-500 text-[15px] leading-relaxed flex-1">
                Connect to your existing tools. AutoDS, AliExpress, WhatsApp,
                Stripe and more.
              </p>
              <div className="mt-5 h-52 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-2 w-full">
                  {[
                    {
                      Icon: ShoppingBag,
                      color: "text-orange-500",
                      bg: "from-orange-50 to-rose-50",
                      border: "border-orange-100",
                    },
                    {
                      Icon: Bot,
                      color: "text-blue-500",
                      bg: "from-blue-50 to-indigo-50",
                      border: "border-blue-100",
                    },
                    {
                      Icon: CreditCard,
                      color: "text-violet-500",
                      bg: "from-violet-50 to-purple-50",
                      border: "border-violet-100",
                    },
                    {
                      Icon: Package,
                      color: "text-amber-500",
                      bg: "from-amber-50 to-yellow-50",
                      border: "border-amber-100",
                    },
                    {
                      Icon: BarChart3,
                      color: "text-emerald-500",
                      bg: "from-emerald-50 to-teal-50",
                      border: "border-emerald-100",
                    },
                    {
                      Icon: MessageSquare,
                      color: "text-sky-500",
                      bg: "from-sky-50 to-cyan-50",
                      border: "border-sky-100",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-xl border ${item.border} bg-linear-to-br ${item.bg} flex items-center justify-center text-xl hover:scale-110 transition-transform duration-200 cursor-default shadow-xs`}
                    >
                      {" "}
                      <item.Icon className={`h-6 w-6 ${item.color}`} />{" "}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Security banner */}
          <div className="relative rounded-3xl border border-zinc-100 bg-linear-to-br from-zinc-950 to-zinc-800 overflow-hidden shadow-xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
            <GridPattern className="absolute inset-0 text-white/5 z-0" />
            {/* Glow spots */}
            <div className="absolute top-0 left-1/4 w-64 h-32 rounded-full bg-violet-500/10 blur-[60px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-32 rounded-full bg-blue-500/10 blur-[60px] pointer-events-none" />
            <div className="relative z-10 flex-1">
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-linear-to-br from-zinc-700 to-zinc-600 border border-white/10 shadow-md mb-5">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                Enterprise-grade security
              </h3>
              <p className="text-zinc-400 text-[15px] leading-relaxed max-w-md">
                SOC 2 Type II, end-to-end encryption, fraud detection, and
                PCI-compliant payments — all baked in by default.
              </p>
            </div>
            <div className="relative z-10 flex flex-col gap-3 min-w-[220px]">
              {[
                "SOC 2 Type II",
                "PCI DSS Level 1",
                "GDPR Compliant",
                "99.9% uptime SLA",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 text-[14px] text-zinc-300 font-medium"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-blue-500 shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 
            5. TESTIMONIALS
             */}
        <section className="w-full border-y border-zinc-100 bg-linear-to-b from-zinc-50 to-white py-20 md:py-28">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-4">
                <Star className="h-3 w-3 fill-amber-500" /> Testimonials
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-zinc-950">
                Merchants love Kaka Malem.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  quote:
                    "Setting up a full store used to take me days. With Kaka Malem, I launched my first dropshipping store in under an hour.",
                  name: "Ahmad Reza",
                  role: "Dropshipper, Tehran",
                  stars: 5,
                  gradient: "from-violet-50 to-blue-50",
                  border: "border-violet-100",
                  avatarBg: "from-violet-400 to-purple-500",
                },
                {
                  quote:
                    "The AutoDS integration alone saves me hours every week. Orders just flow through automatically — it's genuinely magical.",
                  name: "Sara Mohammadi",
                  role: "E-commerce founder",
                  stars: 5,
                  gradient: "from-blue-50 to-sky-50",
                  border: "border-blue-100",
                  avatarBg: "from-blue-400 to-cyan-500",
                },
                {
                  quote:
                    "I've tried Shopify, WooCommerce, and a dozen others. Kaka Malem is the only one that feels like it was built for real merchants.",
                  name: "Milad Karimi",
                  role: "Multi-store owner",
                  stars: 5,
                  gradient: "from-emerald-50 to-teal-50",
                  border: "border-emerald-100",
                  avatarBg: "from-emerald-400 to-teal-500",
                },
              ].map((t, i) => (
                <div
                  key={i}
                  className={`rounded-3xl border ${t.border} bg-linear-to-br ${t.gradient} p-8 flex flex-col gap-4 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 cursor-default`}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <Star
                        key={s}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-zinc-700 text-[15px] leading-relaxed flex-1 font-[430]">
                    &quot;{t.quote}&quot;
                  </p>
                  <div className="flex items-center gap-3 pt-3 border-t border-white/60">
                    <div
                      className={`h-9 w-9 rounded-full bg-linear-to-br ${t.avatarBg} flex items-center justify-center text-sm font-bold text-white shadow-sm`}
                    >
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-zinc-900">
                        {t.name}
                      </p>
                      <p className="text-[12px] text-zinc-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 
            6. PRICING
             */}
        <section
          id="pricing"
          className="w-full max-w-5xl px-4 py-20 md:py-28 scroll-mt-24"
        >
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em] mb-4">
              <Sparkles className="h-3 w-3" /> Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950 mb-4">
              Simple, transparent pricing.
            </h2>
            <p className="text-zinc-500 text-lg">
              Start for free. Upgrade when you scale.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Hobby */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-5">
                Hobby
              </h3>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-[3.25rem] leading-none font-extrabold tracking-tight text-zinc-950">
                  $0
                </span>
                <span className="text-zinc-400 font-medium pb-2.5">/month</span>
              </div>
              <p className="text-[14px] text-zinc-500 mb-6 pb-6 border-b border-zinc-100">
                For individuals exploring the platform.
              </p>
              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  "1 store",
                  "Up to 50 products",
                  "Community support",
                  "Basic analytics",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[15px] text-zinc-600"
                  >
                    <div className="h-5 w-5 rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-zinc-400" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-full border-zinc-200 hover:border-zinc-300"
                asChild
              >
                <Link href="/signup">Get started free</Link>
              </Button>
            </div>

            {/* Pro */}
            <div className="relative rounded-3xl bg-linear-to-br from-zinc-950 to-zinc-800 pt-10 pb-8 px-8 flex flex-col shadow-2xl shadow-zinc-900/20">
              {/* Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-linear-to-r from-violet-500 to-blue-500 px-5 py-1 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap shadow-lg shadow-violet-500/30">
                Most Popular
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-5">
                Pro
              </h3>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-[3.25rem] leading-none font-extrabold tracking-tight text-white">
                  $20
                </span>
                <span className="text-zinc-500 font-medium pb-2.5">/month</span>
              </div>
              <p className="text-[14px] text-zinc-500 mb-6 pb-6 border-b border-white/10">
                For scaling businesses with real volume.
              </p>
              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  "Unlimited stores",
                  "Unlimited products",
                  "Priority 24/7 support",
                  "Advanced analytics",
                  "0% transaction fees",
                  "Custom domains",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-[15px] text-zinc-200 font-medium"
                  >
                    <div className="h-5 w-5 rounded-full bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full rounded-full bg-linear-to-r from-violet-500 to-blue-500 hover:from-violet-400 hover:to-blue-400 border-0 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
                asChild
              >
                <Link href="/signup">Upgrade to Pro</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 
            7. BOTTOM CTA
             */}
        <section className="relative w-full overflow-hidden py-24 md:py-36 px-4 flex flex-col items-center text-center bg-linear-to-b from-white via-violet-50/30 to-white">
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <GridPattern className="absolute inset-0 text-violet-200/30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-linear-to-b from-violet-100/60 to-transparent blur-[100px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[13px] font-medium text-violet-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              No credit card required
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-zinc-950 mb-6 max-w-2xl text-balance leading-[1.05]">
              Start building{" "}
              <span className="bg-linear-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                your store
              </span>{" "}
              today.
            </h2>
            <p className="text-zinc-500 text-lg mb-10 max-w-lg leading-relaxed">
              Join 1,200+ merchants already using Kaka Malem to sell products
              globally.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                size="lg"
                className="rounded-full px-8 h-12 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 border-0 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all gap-2"
                asChild
              >
                <Link href="/signup">
                  Create your free store <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 h-12 border-zinc-200 hover:border-zinc-300 bg-white"
                asChild
              >
                <Link href="#features">Explore the platform</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 
          8. FOOTER
           */}
      <footer className="border-t border-zinc-100 bg-zinc-950 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-12 gap-x-8 mb-16">
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
                The modern platform for building high-performance e-commerce
                experiences at scale.
              </p>
              <div className="flex items-center gap-2.5 mt-2">
                <Link
                  href="https://www.facebook.com/KakaMalem"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-[#1877F2] hover:border-white/20 hover:bg-white/10 transition-all"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </Link>
                <Link
                  href="https://www.instagram.com/kaka_malem/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-[#E4405F] hover:border-white/20 hover:bg-white/10 transition-all"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </Link>
                <Link
                  href="https://www.tiktok.com/@kakamalem"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all group"
                >
                  <svg
                    className="h-4 w-4 overflow-visible transition-all duration-300 group-hover:filter-[drop-shadow(-1px_-0.5px_0.3px_#25F4EE)_drop-shadow(2px_1px_0.3px_#FE2C55)]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                </Link>
              </div>
            </div>

            {[
              {
                title: "Product",
                links: [
                  ["#features", "Features"],
                  ["#pricing", "Pricing"],
                ],
              },
              {
                title: "Socials",
                links: [
                  ["https://www.facebook.com/KakaMalem", "Facebook"],
                  ["https://www.instagram.com/kaka_malem/", "Instagram"],
                  ["https://www.tiktok.com/@kakamalem", "TikTok"],
                ],
              },
              {
                title: "Legal",
                links: [
                  ["/privacy", "Privacy Policy"],
                  ["/terms", "Terms of Service"],
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
                        {...(href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
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
              Â© {new Date().getFullYear()} Kaka Malem Inc. All rights reserved.
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
