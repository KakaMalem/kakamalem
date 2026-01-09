"use client";

import dynamic from "next/dynamic";
import { StoreHeaderSkeletonShimmer } from "@/components/store/store-header-skeleton";

import type { Tenant } from "@/lib/db/schema";
import type { StoreRole } from "@/lib/auth/context";

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
  userContext?: {
    isOwner: boolean;
    isStaff: boolean;
    isMember: boolean;
    role: StoreRole;
  } | null;
}

export function StoreHeaderWrapper({
  store,
  cartItemCount,
  user,
  userContext,
}: StoreHeaderWrapperProps) {
  return (
    <StoreHeader
      store={store}
      cartItemCount={cartItemCount}
      user={user}
      userContext={userContext}
    />
  );
}
