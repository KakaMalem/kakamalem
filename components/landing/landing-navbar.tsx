"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";

interface NavLink {
  label: string;
  href: string;
}

interface NavCTA {
  label: string;
  href: string;
  variant?: "default" | "outline";
  icon?: React.ReactNode;
}

interface LandingNavbarProps {
  user?: { id: string; email: string } | null;
  navLinks?: NavLink[];
  ctas?: NavCTA[];
}

const defaultNavLinks: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Affiliates", href: "/affiliate" },
];

export function LandingNavbar({
  user,
  navLinks = defaultNavLinks,
  ctas,
}: LandingNavbarProps) {
  const defaultCTAs: NavCTA[] = user
    ? [{ label: "Dashboard", href: "/dashboard", variant: "default" }]
    : [
        { label: "Login", href: "/login", variant: "outline" },
        { label: "Start Free", href: "/signup", variant: "default" },
      ];

  const activeCTAs = ctas || defaultCTAs;

  return (
    <header className="landing-section sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="landing-section-content flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold">
          Kaka Malem
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          {activeCTAs.map((cta) => (
            <Button
              key={cta.href}
              variant={cta.variant || "default"}
              size="sm"
              asChild
            >
              <Link href={cta.href}>
                {cta.label}
                {cta.icon}
              </Link>
            </Button>
          ))}
        </div>

        {/* Mobile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="size-9">
              <Menu className="size-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[calc(100vw-2rem)] min-w-70 max-w-sm"
          >
            <nav className="grid gap-1 p-1">
              {navLinks.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  asChild
                  className="h-11 cursor-pointer px-3 text-base font-medium"
                >
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                asChild
                className="h-11 cursor-pointer px-3 text-base font-medium"
              >
                <Link href="/">Home</Link>
              </DropdownMenuItem>
            </nav>
            <DropdownMenuSeparator className="mx-2 my-2" />
            <div className="grid gap-2 p-2">
              {activeCTAs.map((cta) => (
                <Button
                  key={cta.href}
                  variant={cta.variant || "default"}
                  className="w-full justify-center"
                  asChild
                >
                  <Link href={cta.href}>
                    {cta.label}
                    {cta.icon}
                  </Link>
                </Button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
