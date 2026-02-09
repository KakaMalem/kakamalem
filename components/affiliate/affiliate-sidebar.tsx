"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  Users,
  Wallet,
  History,
  Settings,
  ExternalLink,
  Trophy,
  LogOut,
  ChevronUp,
  Home,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AffiliateSidebarProps {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl?: string;
  };
  affiliate: {
    id: string;
    displayName: string;
    slug: string;
    currentTier: "bronze" | "silver" | "gold";
    status: string;
  };
}

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/affiliate/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Link",
    href: "/affiliate/dashboard/link",
    icon: Link2,
  },
  {
    title: "Referrals",
    href: "/affiliate/dashboard/referrals",
    icon: Users,
  },
  {
    title: "Earnings",
    href: "/affiliate/dashboard/earnings",
    icon: Wallet,
  },
  {
    title: "Payouts",
    href: "/affiliate/dashboard/payouts",
    icon: History,
  },
];

const settingsNavItems = [
  {
    title: "Profile",
    href: "/affiliate/dashboard/profile",
    icon: Settings,
  },
];

const tierColors = {
  bronze: "bg-amber-100 text-amber-800",
  silver: "bg-slate-100 text-slate-800",
  gold: "bg-yellow-100 text-yellow-800",
};

export function AffiliateSidebar({ user, affiliate }: AffiliateSidebarProps) {
  const pathname = usePathname();

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/affiliate/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Trophy className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Affiliate</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {affiliate.displayName}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Tier Badge */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-2 py-3">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "capitalize",
                    tierColors[affiliate.currentTier]
                  )}
                >
                  {affiliate.currentTier} Tier
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                kakamalem.com/{affiliate.slug}
              </p>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Links */}
        <SidebarGroup>
          <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to Kaka Malem">
                  <Link href="/">
                    <Home className="size-4" />
                    <span>Back to Kaka Malem</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="View Your Link">
                  <Link href={`/${affiliate.slug}`} target="_blank">
                    <ExternalLink className="size-4" />
                    <span>View Your Link</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={user.fullName || user.email}
                    />
                    <AvatarFallback className="rounded-lg">
                      {getInitials(user.fullName, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user.fullName || "Affiliate"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/affiliate/dashboard/profile">
                    <Settings className="mr-2 size-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/logout">
                    <LogOut className="mr-2 size-4" />
                    Log out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
