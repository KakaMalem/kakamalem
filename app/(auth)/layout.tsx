import Link from "next/link";
import Image from "next/image";
import { CreditCard, Truck, Globe } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-zinc-950">
        {/* Subtle ambient glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/4 blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/3 blur-[80px]" />

        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full text-white/3">
          <defs>
            <pattern
              id="auth-grid"
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
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>

        {/* Content */}
        <div className="relative flex flex-col justify-between w-full p-10 xl:p-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/icons/android-chrome-192x192.png"
              alt="Kaka Malem"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="font-bold text-lg tracking-tight text-white">
              Kaka Malem
            </span>
          </Link>

          {/* Value props */}
          <div className="space-y-10">
            <div>
              <h2 className="text-3xl xl:text-4xl font-bold text-white tracking-tight leading-tight mb-3">
                Your store, online,
                <br />
                <span className="bg-linear-to-r from-teal-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  in a single afternoon.
                </span>
              </h2>
              <p className="text-zinc-400 text-[15px] leading-relaxed max-w-sm">
                Build your storefront, accept payments via HesabPay or cash on
                delivery, and manage orders from a single dashboard.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: CreditCard,
                  text: "HesabPay hosted checkout",
                },
                {
                  icon: Truck,
                  text: "Cash on Delivery built in",
                },
                {
                  icon: Globe,
                  text: "Custom domain with free SSL",
                },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/6 border border-white/8">
                    <item.icon className="h-4 w-4 text-zinc-300" />
                  </div>
                  <span className="text-sm text-zinc-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <a
              href="https://find-and-update.company-information.service.gov.uk/company/17054971"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors"
            >
              UK Registered Company
            </a>
            <span>&middot;</span>
            <Link
              href="/terms"
              className="hover:text-zinc-400 transition-colors"
            >
              Terms
            </Link>
            <span>&middot;</span>
            <Link
              href="/privacy"
              className="hover:text-zinc-400 transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-5 pt-5">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icons/android-chrome-192x192.png"
              alt="Kaka Malem"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="font-bold tracking-tight text-zinc-900">
              Kaka Malem
            </span>
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
