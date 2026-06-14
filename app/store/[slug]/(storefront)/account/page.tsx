import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Heart,
  MapPin,
  Settings,
  ChevronRight,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { getUser } from "@/lib/auth/server";
import { getUserStoreContext } from "@/lib/auth/context";
import {
  getRecentOrdersSummary,
  getOrderStatusInfo,
} from "@/lib/db/queries/orders";
import { getWishlistItemCount } from "@/lib/db/queries/wishlists";
import { getAddressCount } from "@/lib/db/queries/addresses";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

interface AccountPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { slug } = await params;

  const store = await resolveTenant(slug);
  if (!store) {
    notFound();
  }

  const user = await getUser();
  if (!user) {
    return null;
  }

  const basePath = await getStoreBasePath(store.slug);
  const baseUrl = `${basePath}/account`;

  // Fetch data in parallel
  const [recentOrders, wishlistCount, addressCount, userContext] =
    await Promise.all([
      getRecentOrdersSummary(store.id, user.id, 3),
      getWishlistItemCount(store.id, user.id),
      getAddressCount(user.id),
      getUserStoreContext(store.id),
    ]);

  // Owner/staff can jump to the management dashboard. On a custom domain the
  // dashboard lives on the main app host; on a path-based store it's relative.
  const dashboardUrl =
    basePath === ""
      ? `${process.env.NEXT_PUBLIC_APP_URL || "https://kakamalem.com"}/dashboard/${store.slug}`
      : `/dashboard/${store.slug}`;

  const quickLinks = [
    {
      href: `${baseUrl}/orders`,
      icon: Package,
      title: "Orders",
      description: "View your order history",
    },
    {
      href: `${baseUrl}/addresses`,
      icon: MapPin,
      title: "Addresses",
      description:
        addressCount > 0
          ? `${addressCount} saved ${
              addressCount === 1 ? "address" : "addresses"
            }`
          : "Manage saved addresses",
    },
    {
      href: `${baseUrl}/wishlist`,
      icon: Heart,
      title: "Wishlist",
      description:
        wishlistCount > 0
          ? `${wishlistCount} saved ${wishlistCount === 1 ? "item" : "items"}`
          : "Products you've saved",
    },
    {
      href: `${baseUrl}/settings`,
      icon: Settings,
      title: "Settings",
      description: "Account preferences",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome back, {user.name || "there"}!</CardTitle>
          <CardDescription>
            Manage your account, view orders, and update your preferences for{" "}
            {store.name}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${baseUrl}/orders`}>
                View all
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const statusInfo = getOrderStatusInfo(order.status);
                const orderDate = new Date(order.createdAt);
                return (
                  <Link
                    key={order.id}
                    href={`${baseUrl}/orders/${order.id}`}
                    className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {orderDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                      <span className="font-medium">
                        {formatPrice(parseFloat(order.total), store.currency)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:bg-muted/50 h-full">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <link.icon className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{link.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Dashboard (owners/staff) + sign out */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        {userContext?.isMember && (
          <Button variant="outline" asChild className="sm:flex-1">
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              <LayoutDashboard className="mr-2 size-4" />
              Store Dashboard
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          asChild
          className="text-destructive hover:text-destructive sm:flex-1"
        >
          <Link href={`${basePath}/logout`}>
            <LogOut className="mr-2 size-4" />
            Sign out
          </Link>
        </Button>
      </div>
    </div>
  );
}
