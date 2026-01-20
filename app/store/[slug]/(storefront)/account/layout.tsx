import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { User, Package, Heart, MapPin, Settings } from "lucide-react";

import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getUser } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

const accountNavItems = [
  { href: "", label: "Account", icon: User },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/addresses", label: "Addresses", icon: MapPin },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function AccountLayout({
  children,
  params,
}: AccountLayoutProps) {
  const { slug } = await params;

  // Fetch store data
  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  // Check authentication
  const user = await getUser();
  if (!user) {
    redirect(`/store/${slug}/auth/login?redirect=/store/${slug}/account`);
  }

  const baseUrl = `/store/${slug}/account`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="text-muted-foreground">
          Manage your account at {store.name}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar Navigation */}
        <nav className="w-full shrink-0 lg:w-56">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
            {accountNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={`${baseUrl}${item.href}`}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                    "lg:w-full"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
