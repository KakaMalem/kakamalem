"use client";

import { motion } from "framer-motion";
import { Check, Crown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  index: number;
  isLoggedIn?: boolean;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted = false,
  index,
  isLoggedIn = false,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      whileHover={{ y: -4 }}
      className={cn(
        "relative flex flex-col rounded-xl border-2 p-6 shadow-sm transition-shadow hover:shadow-lg",
        highlighted
          ? "border-primary bg-primary/2 ring-1 ring-primary"
          : "border-border bg-background"
      )}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Recommended
          </span>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2">
          {highlighted && <Crown className="size-5" />}
          <h3 className="text-lg font-semibold">{name}</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">{price}</span>
          {period && <span className="text-muted-foreground">/{period}</span>}
        </div>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {highlighted ? (
        isLoggedIn ? (
          <Button asChild size="lg" className="w-full">
            <Link href="/dashboard">
              <Crown className="mr-2 size-4" />
              {cta}
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href="/login">
              <Crown className="mr-2 size-4" />
              {cta}
            </Link>
          </Button>
        )
      ) : (
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href={ctaHref}>{cta}</Link>
        </Button>
      )}
    </motion.div>
  );
}
