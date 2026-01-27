"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLastStoreSlug } from "@/lib/hooks/use-last-store";

interface StoreRedirectProps {
  stores: { slug: string }[];
  fallbackSlug: string;
  targetPath: string;
}

export function StoreRedirect({
  stores,
  fallbackSlug,
  targetPath,
}: StoreRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const lastSlug = getLastStoreSlug();

    // Check if the last visited store is still valid (user has access)
    const isValidStore = lastSlug && stores.some((s) => s.slug === lastSlug);
    const storeSlug = isValidStore ? lastSlug : fallbackSlug;

    router.replace(`/dashboard/${storeSlug}${targetPath}`);
  }, [stores, fallbackSlug, targetPath, router]);

  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
