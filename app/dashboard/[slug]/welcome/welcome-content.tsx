"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Package,
  ArrowRight,
  Store,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { Tenant } from "@/lib/db/schema";

interface WelcomeContentProps {
  store: Tenant;
}

interface ConfettiParticleProps {
  delay: number;
  x: number;
  color: string;
  xOffset: number;
  rotation: number;
  duration: number;
}

// Confetti particle component - all random values passed as props
function ConfettiParticle({
  delay,
  x,
  color,
  xOffset,
  rotation,
  duration,
}: ConfettiParticleProps) {
  return (
    <motion.div
      className={`absolute w-2 h-2 rounded-full ${color}`}
      initial={{ y: -20, x, opacity: 1, scale: 1 }}
      animate={{
        y: 400,
        x: x + xOffset,
        opacity: 0,
        scale: 0,
        rotate: rotation,
      }}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

const CONFETTI_COLORS = [
  "bg-primary",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-pink-500",
  "bg-purple-500",
];

// Generate particles with pre-computed random values
function generateConfettiParticles() {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 400 - 200,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    xOffset: (Math.random() - 0.5) * 100,
    rotation: Math.random() * 360,
    duration: 2 + Math.random(),
  }));
}

export function WelcomeContent({ store }: WelcomeContentProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  // Generate confetti particles once using useMemo (stable across renders)
  const confettiParticles = useMemo(() => generateConfettiParticles(), []);

  // Hide confetti after animation
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Confetti animation */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
            {confettiParticles.map((particle) => (
              <ConfettiParticle
                key={particle.id}
                delay={particle.delay}
                x={particle.x}
                color={particle.color}
                xOffset={particle.xOffset}
                rotation={particle.rotation}
                duration={particle.duration}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-lg space-y-8">
        {/* Success Icon */}
        <motion.div
          className="flex justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1,
          }}
        >
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Your store is ready!
          </h1>
          <p className="text-muted-foreground text-lg">
            Congratulations! <span className="font-semibold">{store.name}</span>{" "}
            has been created successfully.
          </p>
        </motion.div>

        {/* Store Card Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {store.logoUrl ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image
                      src={store.logoUrl}
                      alt={store.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{store.name}</p>
                  {store.tagline && (
                    <p className="text-sm text-muted-foreground truncate">
                      {store.tagline}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">
                    kakamalem.com/store/{store.slug}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/store/${store.slug}`;
                    window.open(url, "_blank", "");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              What&apos;s next?
            </p>
          </div>

          {/* Primary CTA - Add First Product */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold">Add your first product</p>
                    <p className="text-sm text-muted-foreground">
                      Start showcasing what you sell. Add products with photos,
                      prices, and descriptions.
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/dashboard/${store.slug}/products/new`}>
                      Add product
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Secondary Action */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/${store.slug}`}>
              Skip for now, go to dashboard
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
