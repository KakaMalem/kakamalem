"use client";

import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyCartProps {
  storeSlug: string;
}

export function EmptyCart({ storeSlug }: EmptyCartProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">
        Your cart is empty
      </h2>

      <p className="mt-2 max-w-sm text-muted-foreground">
        Looks like you haven&apos;t added anything to your cart yet. Start
        shopping to fill it up!
      </p>

      <Button size="lg" className="mt-6" asChild>
        <Link href={`/store/${storeSlug}`}>
          Continue Shopping
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
