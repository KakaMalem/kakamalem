"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavLink {
  label: string;
  href: string;
}

export function LandingNavbar({
  user,
  links,
}: {
  user?: unknown;
  links?: NavLink[];
}) {
  const defaultNavLinks: NavLink[] = [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Affiliates", href: "/affiliate" },
  ];

  const navLinks = links || defaultNavLinks;

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-5 px-4 pointer-events-none">
      <header className="pointer-events-auto flex h-14 w-full max-w-4xl items-center justify-between rounded-full border border-zinc-200/80 bg-white/70 px-5 backdrop-blur-2xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <Image
            src="/icons/android-chrome-192x192.png"
            alt="Kaka Malem"
            width={24}
            height={24}
            className="rounded-md"
          />
          <span className="font-bold tracking-tight text-zinc-950">
            Kaka Malem
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/80 px-3 py-1.5 rounded-full transition-all duration-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA section */}
        <div className="flex items-center gap-3">
          {/* Login — hidden when signed in */}
          {!user && (
            <Link
              href="/login"
              className="hidden md:block text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              Login
            </Link>
          )}

          {/* Primary CTA */}
          <Button
            size="sm"
            className="rounded-full h-8 px-4 text-xs font-semibold bg-linear-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 border-0 shadow-sm shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200"
            asChild
          >
            <Link href={user ? "/dashboard" : "/signup"}>
              {user ? "Dashboard" : "Start Building"}
            </Link>
          </Button>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-zinc-100/80 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <Menu className="h-4 w-4 text-zinc-600" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={24}
              className="w-70 sm:w-80 rounded-3xl border border-zinc-200/80 bg-white/90 backdrop-blur-3xl shadow-[0_24px_60px_-15px_rgba(0,0,0,0.1)] p-3 z-100 animate-in fade-in zoom-in-95 slide-in-from-top-4 overflow-hidden"
            >
              <nav className="grid gap-1">
                {navLinks.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    asChild
                    className="h-12 cursor-pointer rounded-xl px-4 text-[15px] font-semibold text-zinc-600 hover:text-zinc-950 focus:text-zinc-950 hover:bg-zinc-100/80 focus:bg-zinc-100/80 transition-all duration-200"
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </nav>
              {!user && (
                <>
                  <DropdownMenuSeparator className="mx-2 my-2 bg-zinc-100" />
                  <div className="px-1 pb-1">
                    <Button
                      variant="outline"
                      className="w-full h-11 justify-center rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 hover:text-zinc-950 text-[15px] font-semibold shadow-sm transition-all duration-200"
                      asChild
                    >
                      <Link href="/login">Login</Link>
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}
