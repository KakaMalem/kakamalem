import Link from "next/link";
import {
  getAdminDashboardStats,
  getStoresWithTrialEndingSoon,
  getStoresWithExpiredTrials,
  getPlatformSettings,
} from "@/lib/db/queries/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Store,
  Users,
  Package,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Settings,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { SystemStatus } from "@/components/admin/system-status";
import { StorageHealth } from "@/components/admin/storage-health";

// =============================================================================
// ADMIN DASHBOARD
// =============================================================================
// Overview of platform statistics and alerts
// Mobile-first responsive design
// =============================================================================

export default async function AdminDashboardPage() {
  const settings = await getPlatformSettings();

  const [stats, trialEndingSoon, expiredTrials] = await Promise.all([
    getAdminDashboardStats(),
    getStoresWithTrialEndingSoon(settings.trialWarningDays),
    getStoresWithExpiredTrials(),
  ]);

  // Calculate health metrics
  const healthyStores = stats.activeStores;
  const problemStores = stats.suspendedStores + stats.expiredTrials;
  const healthPercentage =
    stats.totalStores > 0
      ? Math.round((healthyStores / stats.totalStores) * 100)
      : 100;

  const hasAlerts = expiredTrials.length > 0 || trialEndingSoon.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Platform overview and quick actions
        </p>
      </div>

      {/* Critical Alerts Banner */}
      {expiredTrials.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {expiredTrials.length} store{expiredTrials.length > 1 ? "s" : ""}{" "}
              with expired trials need your attention.
            </span>
            <Link href="/admin/stores?subscriptionStatus=expired">
              <Button size="sm" variant="outline" className="mt-2 sm:mt-0">
                Review Now
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Platform Health Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Platform Health
            </CardTitle>
            <Badge
              variant={healthPercentage >= 80 ? "default" : "secondary"}
              className="font-mono"
            >
              {healthPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={healthPercentage} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
            <div className="rounded-lg bg-green-50 p-2">
              <div className="flex items-center justify-center gap-1 text-green-600">
                <CheckCircle2 className="size-3.5" />
                <span className="font-semibold">{healthyStores}</span>
              </div>
              <p className="text-muted-foreground">Active</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <div className="flex items-center justify-center gap-1 text-amber-600">
                <Clock className="size-3.5" />
                <span className="font-semibold">{stats.trialingStores}</span>
              </div>
              <p className="text-muted-foreground">Trialing</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2">
              <div className="flex items-center justify-center gap-1 text-red-600">
                <XCircle className="size-3.5" />
                <span className="font-semibold">{problemStores}</span>
              </div>
              <p className="text-muted-foreground">Issues</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health - Infrastructure Monitoring */}
      <SystemStatus />

      {/* Storage Health - Media & Uploads Monitoring */}
      <StorageHealth />

      {/* Stats Grid - 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Stores"
          value={stats.totalStores}
          icon={Store}
          trend={`${stats.activeStores} active`}
          href="/admin/stores"
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          href="/admin/users"
          color="purple"
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          color="green"
        />
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          color="orange"
        />
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-semibold">Attention Needed</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Trials Ending Soon */}
            {trialEndingSoon.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-500" />
                    <CardTitle className="text-sm font-medium">
                      Trials Ending Soon
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {trialEndingSoon.length} store
                    {trialEndingSoon.length > 1 ? "s" : ""} ending in{" "}
                    {settings.trialWarningDays} days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {trialEndingSoon.slice(0, 3).map((store) => (
                    <StoreListItem
                      key={store.id}
                      store={store}
                      badge={
                        <Badge variant="outline" className="text-amber-600">
                          {formatDaysUntil(
                            store.trialEndsAt
                              ? new Date(store.trialEndsAt)
                              : new Date()
                          )}
                        </Badge>
                      }
                    />
                  ))}
                  {trialEndingSoon.length > 3 && (
                    <Link
                      href="/admin/stores?subscriptionStatus=trialing"
                      className="block"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                      >
                        View all {trialEndingSoon.length}
                        <ArrowRight className="ml-1 size-3" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Expired Trials */}
            {expiredTrials.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-red-500" />
                    <CardTitle className="text-sm font-medium">
                      Expired Trials
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {expiredTrials.length} store
                    {expiredTrials.length > 1 ? "s" : ""} need action
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {expiredTrials.slice(0, 3).map((store) => (
                    <StoreListItem
                      key={store.id}
                      store={store}
                      variant="danger"
                      action={
                        <Link href={`/admin/stores/${store.id}`}>
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </Link>
                      }
                    />
                  ))}
                  {expiredTrials.length > 3 && (
                    <Link
                      href="/admin/stores?subscriptionStatus=expired"
                      className="block"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                      >
                        View all {expiredTrials.length}
                        <ArrowRight className="ml-1 size-3" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* No Alerts State */}
      {!hasAlerts && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="mb-2 size-8 text-green-500" />
            <p className="font-medium">All Clear</p>
            <p className="text-sm text-muted-foreground">
              No stores need attention right now
            </p>
          </CardContent>
        </Card>
      )}

      <Separator className="md:hidden" />

      {/* Quick Actions - Mobile only */}
      <div className="space-y-3 md:hidden">
        <h2 className="text-sm font-medium text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Link href="/admin/stores" className="sm:w-auto">
            <Button variant="outline" className="w-full justify-start">
              <Store className="mr-2 size-4" />
              <span className="truncate">Manage Stores</span>
            </Button>
          </Link>
          <Link href="/admin/settings" className="sm:w-auto">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="mr-2 size-4" />
              <span className="truncate">Settings</span>
            </Button>
          </Link>
          <Link
            href="/admin/stores?subscriptionStatus=trialing"
            className="sm:w-auto"
          >
            <Button variant="outline" className="w-full justify-start">
              <Clock className="mr-2 size-4" />
              <span className="truncate">Trial Stores</span>
            </Button>
          </Link>
          <Link href="/admin/stores?status=suspended" className="sm:w-auto">
            <Button variant="outline" className="w-full justify-start">
              <AlertTriangle className="mr-2 size-4" />
              <span className="truncate">Suspended</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  href,
  color = "primary",
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  href?: string;
  color?: "blue" | "purple" | "green" | "orange" | "primary";
}) {
  const colorClasses = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-600",
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-600",
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-600",
    },
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-600",
    },
    primary: {
      bg: "bg-primary/10",
      text: "text-primary",
    },
  };

  const colors = colorClasses[color];

  const content = (
    <Card className={href ? "transition-colors hover:bg-muted/50" : ""}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">
              {title}
            </p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">
              {value.toLocaleString()}
            </p>
            <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">
              {trend || "\u00A0"}
            </p>
          </div>
          <div className={`ml-2 rounded-lg p-2 sm:p-2.5 ${colors.bg}`}>
            <Icon className={`size-4 sm:size-5 ${colors.text}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function StoreListItem({
  store,
  badge,
  action,
  variant = "default",
}: {
  store: {
    id: string;
    name: string;
    owner?: { name?: string | null; email: string } | null;
  };
  badge?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const initials = store.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        variant === "danger" ? "border-red-200 bg-red-50/50" : ""
      }`}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{store.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {store.owner?.email}
        </p>
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function formatDaysUntil(date: Date): string {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Expired";
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}
