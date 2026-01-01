"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLastStoreSlug } from "@/lib/hooks/use-last-store";

interface DashboardRedirectProps {
  stores: { slug: string }[];
  fallbackSlug: string;
}

export function DashboardRedirect({
  stores,
  fallbackSlug,
}: DashboardRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const lastSlug = getLastStoreSlug();

    // Check if the last visited store is still valid (user has access)
    const isValidStore = lastSlug && stores.some((s) => s.slug === lastSlug);

    if (isValidStore) {
      router.replace(`/dashboard/${lastSlug}`);
    } else {
      router.replace(`/dashboard/${fallbackSlug}`);
    }
  }, [stores, fallbackSlug, router]);

  // Show a brief loading state while redirecting
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
