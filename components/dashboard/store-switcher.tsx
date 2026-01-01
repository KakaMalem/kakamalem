"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronsUpDown, Plus, Check, Store } from "lucide-react";

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
import Image from "next/image";
import { useLastStore } from "@/lib/hooks/use-last-store";

export type StoreInfo = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
};

interface StoreSwitcherProps {
  stores: StoreInfo[];
  currentStore?: StoreInfo | null;
}

// Reserved paths that are not store slugs
const reservedPaths = new Set(["new", "account"]);

// Extract store slug from pathname
function getStoreSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (match && !reservedPaths.has(match[1])) {
    return match[1];
  }
  return null;
}

export function StoreSwitcher({
  stores,
  currentStore: initialStore,
}: StoreSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Mark as hydrated after first render
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Derive current store from URL path for client-side navigation
  const urlSlug = getStoreSlugFromPath(pathname);
  const currentStore = React.useMemo(() => {
    if (urlSlug) {
      return stores.find((s) => s.slug === urlSlug) || initialStore;
    }
    // On /dashboard page (no urlSlug), check localStorage for last store
    if (isHydrated && typeof window !== "undefined") {
      const lastSlug = localStorage.getItem("kaka-malem-last-store");
      if (lastSlug) {
        const lastStore = stores.find((s) => s.slug === lastSlug);
        if (lastStore) return lastStore;
      }
    }
    return initialStore;
  }, [urlSlug, stores, initialStore, isHydrated]);

  // Only persist when we're on a store-specific page (not /dashboard redirect page)
  // This prevents overwriting the saved store during redirect
  useLastStore(urlSlug ? currentStore?.slug : undefined);

  const handleStoreSelect = (store: StoreInfo) => {
    // Navigate to the selected store's dashboard
    router.push(`/dashboard/${store.slug}`);
  };

  const handleCreateStore = () => {
    router.push("/dashboard/new");
  };

  // Show skeleton while hydrating on /dashboard page to prevent flash
  const isOnRedirectPage = pathname === "/dashboard";
  if (isOnRedirectPage && !isHydrated) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="pointer-events-none">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted animate-pulse" />
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {currentStore.logoUrl ? (
                  <Image
                    src={currentStore.logoUrl}
                    alt={currentStore.name}
                    className="size-6 rounded object-cover"
                  />
                ) : (
                  <Store className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentStore.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  /{currentStore.slug}
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
                  {store.logoUrl ? (
                    <Image
                      src={store.logoUrl}
                      alt={store.name}
                      className="size-4 rounded-sm object-cover"
                    />
                  ) : (
                    <Store className="size-3" />
                  )}
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
