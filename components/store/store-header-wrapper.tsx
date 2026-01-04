"use client";

import dynamic from "next/dynamic";
import { StoreHeaderSkeletonShimmer } from "@/components/store/store-header-skeleton";

import type { Tenant } from "@/lib/db/schema";

// Dynamic import to prevent hydration mismatch with Radix UI components
const StoreHeader = dynamic(
  () =>
    import("@/components/store/store-header").then((mod) => mod.StoreHeader),
  {
    ssr: false,
    loading: () => <StoreHeaderSkeletonShimmer />,
  }
);

interface StoreHeaderWrapperProps {
  store: Tenant;
  cartItemCount: number;
  user: { name?: string; email?: string; avatarUrl?: string } | null;
}

export function StoreHeaderWrapper({
  store,
  cartItemCount,
  user,
}: StoreHeaderWrapperProps) {
  return (
    <StoreHeader store={store} cartItemCount={cartItemCount} user={user} />
  );
}
