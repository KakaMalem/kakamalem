"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const accountNavItems = [
  {
    title: "Profile",
    href: "/dashboard/account",
    description: "Your name and personal information",
  },
  {
    title: "Email",
    href: "/dashboard/account/email",
    description: "Change your email address",
  },
  {
    title: "Password",
    href: "/dashboard/account/password",
    description: "Update your password",
  },
  {
    title: "Notifications",
    href: "/dashboard/account/notification-settings",
    description: "Manage notification preferences",
  },
  {
    title: "Danger Zone",
    href: "/dashboard/account/danger",
    description: "Delete your account",
  },
];

export function AccountSettingsNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/account") {
      return pathname === "/dashboard/account";
    }
    return pathname === href;
  };

  return (
    <nav className="flex flex-col space-y-1">
      {accountNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
            isActive(item.href) && "bg-muted"
          )}
        >
          <span
            className={cn(
              "font-medium",
              !isActive(item.href) && "text-foreground/80"
            )}
          >
            {item.title}
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            {item.description}
          </span>
        </Link>
      ))}
    </nav>
  );
}

// Horizontal tabs version for mobile
export function AccountSettingsNavTabs() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard/account") {
      return pathname === "/dashboard/account";
    }
    return pathname === href;
  };

  return (
    <nav className="flex overflow-x-auto border-b pb-px -mb-px">
      {accountNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            isActive(item.href)
              ? "border-primary text-primary"
              : "border-transparent text-foreground/80 hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
