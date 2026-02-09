"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, Plus, Check, Store, Crown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/ui/logo";
import { useLastStore } from "@/lib/hooks/use-last-store";
import { useSubscription } from "@/lib/stores/use-subscription-store";
import { cn } from "@/lib/utils";

export type StoreInfo = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  posEnabled?: boolean;
  userRole?: "owner" | "admin" | "staff" | null;
};

interface StoreSwitcherProps {
  stores: StoreInfo[];
  currentStore?: StoreInfo | null;
}

// Reserved paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Extract store slug from pathname (handles URL-encoded Unicode slugs)
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

export function StoreSwitcher({
  stores,
  currentStore: initialStore,
}: StoreSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isMounted, setIsMounted] = React.useState(false);
  const subscription = useSubscription();

  // Wait for client-side mount to avoid hydration mismatch
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Subscription helper for plan badge
  const isPro = subscription?.plan === "pro";

  // Derive current store from URL path for client-side navigation
  const urlSlug = getStoreSlugFromPath(pathname);
  const currentStore = React.useMemo(() => {
    if (urlSlug) {
      return stores.find((s) => s.slug === urlSlug) || initialStore;
    }
    // On /dashboard page (no urlSlug), check localStorage for last store
    if (isMounted && typeof window !== "undefined") {
      const lastSlug = localStorage.getItem("kaka-malem-last-store");
      if (lastSlug) {
        const lastStore = stores.find((s) => s.slug === lastSlug);
        if (lastStore) return lastStore;
      }
    }
    return initialStore;
  }, [urlSlug, stores, initialStore, isMounted]);

  // Only persist when we're on a store-specific page (not /dashboard redirect page)
  // This prevents overwriting the saved store during redirect
  useLastStore(urlSlug ? currentStore?.slug : undefined);

  const handleStoreSelect = (store: StoreInfo) => {
    // Close mobile sidebar on navigation
    if (isMobile) {
      setOpenMobile(false);
    }
    // Navigate to the selected store's dashboard
    router.push(`/dashboard/${store.slug}`);
  };

  const handleCreateStore = () => {
    // Close mobile sidebar on navigation
    if (isMobile) {
      setOpenMobile(false);
    }
    router.push("/dashboard/new");
  };

  // Show skeleton until mounted to avoid hydration mismatch with Radix IDs
  if (!isMounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted" />
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // If no current store, show "Create Store" prompt
  if (!currentStore) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={handleCreateStore}
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/50">
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Create Store</span>
              <span className="truncate text-xs text-muted-foreground">
                Set up your first store
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                className={cn(
                  "flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden",
                  currentStore.logoUrl
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground"
                )}
              >
                <Logo
                  logoUrl={currentStore.logoUrl}
                  alt={currentStore.name}
                  size="md"
                  fallback={<Store className="size-4" />}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentStore.name}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">/{currentStore.slug}</span>
                  {subscription && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium leading-none",
                        isPro
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isPro && <Crown className="mr-0.5 size-2.5" />}
                      {isPro ? "Pro" : "Free"}
                    </span>
                  )}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Your Stores
            </DropdownMenuLabel>
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => handleStoreSelect(store)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                  <Logo
                    logoUrl={store.logoUrl}
                    alt={store.name}
                    size="sm"
                    fallback={<Store className="size-3" />}
                  />
                </div>
                <span className="flex-1 truncate">{store.name}</span>
                {store.id === currentStore.id && (
                  <Check className="size-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={handleCreateStore}
              className="gap-2 p-2 mt-1"
            >
              <div className="flex size-6 items-center justify-center rounded-md border border-dashed bg-background">
                <Plus className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                Create Store
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
