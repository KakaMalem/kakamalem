import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAdminUserById,
  getUserAdminNotes,
} from "@/lib/db/queries/admin-users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  User,
  Store,
  ShoppingCart,
  Calendar,
  Shield,
  Mail,
  Phone,
  Globe,
  Clock,
  FileText,
} from "lucide-react";
import { UserActionsClient } from "./user-actions-client";
import { getSession } from "@/lib/auth/server";

// =============================================================================
// ADMIN USER DETAIL PAGE
// =============================================================================
// View and manage individual user
// =============================================================================

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({
  params,
}: UserDetailPageProps) {
  const { id } = await params;
  const [userData, adminNotes, session] = await Promise.all([
    getAdminUserById(id),
    getUserAdminNotes(id),
    getSession(),
  ]);

  if (!userData) {
    notFound();
  }

  const isCurrentUser = session?.user?.id === userData.id;

  const formatDate = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "—";
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "—";
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/users"
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 size-4" />
            Back to users
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={userData.image || undefined} />
              <AvatarFallback className="text-xl">
                {getInitials(userData.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {userData.name || "Unnamed User"}
                </h1>
                {userData.profile?.deletedAt && (
                  <Badge variant="destructive">Deleted</Badge>
                )}
                {isCurrentUser && <Badge variant="outline">You</Badge>}
              </div>
              <p className="text-muted-foreground">{userData.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RoleBadge role={userData.profile?.platformRole || "user"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Email Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VerifiedBadge verified={userData.emailVerified} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Joined
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatDate(userData.createdAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatDate(userData.updatedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - User Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* User Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                User Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Store className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {userData.stats.storesOwned}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stores Owned
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <Shield className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {userData.stats.storesMemberOf}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Staff Member
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <ShoppingCart className="size-8 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {userData.stats.ordersPlaced}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Orders Placed
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="size-4" />
                    Email
                  </span>
                  <span className="font-medium">{userData.email}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-4" />
                    Phone
                  </span>
                  <span className="font-medium">
                    {userData.profile?.phone || "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="size-4" />
                    Preferred Currency
                  </span>
                  <span className="font-medium">
                    {userData.profile?.preferredCurrency || "AFN"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="size-4" />
                    Preferred Language
                  </span>
                  <span className="font-medium">
                    {userData.profile?.preferredLanguage === "fa"
                      ? "Dari"
                      : userData.profile?.preferredLanguage || "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-4" />
                    Account Created
                  </span>
                  <span className="font-medium">
                    {formatDateTime(userData.createdAt)}
                  </span>
                </div>
                {userData.profile?.deletedAt && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2 text-red-600">
                        <Clock className="size-4" />
                        Deleted At
                      </span>
                      <span className="font-medium text-red-600">
                        {formatDateTime(userData.profile.deletedAt)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stores */}
          {(userData.stores.owned.length > 0 ||
            userData.stores.memberOf.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="size-5" />
                  Stores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {userData.stores.owned.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      Owned Stores
                    </h4>
                    <div className="space-y-2">
                      {userData.stores.owned.map((store) => (
                        <Link
                          key={store.id}
                          href={`/admin/stores/${store.id}`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-xs text-muted-foreground">
                              /{store.slug}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StoreBadge status={store.status} />
                            <SubscriptionBadge
                              status={store.subscriptionStatus}
                            />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {userData.stores.memberOf.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      Staff Member At
                    </h4>
                    <div className="space-y-2">
                      {userData.stores.memberOf.map((store) => (
                        <Link
                          key={store.id}
                          href={`/admin/stores/${store.id}`}
                          className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{store.name}</p>
                            <p className="text-xs text-muted-foreground">
                              /{store.slug}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {store.role}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          {userData.recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-5" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userData.recentActivity.slice(0, 10).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 border-l-2 border-muted pl-4"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {formatAction(activity.action)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          by {activity.admin?.name || "System"}
                        </p>
                        {activity.details &&
                        typeof activity.details === "object" &&
                        "note" in activity.details ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {String(
                              (activity.details as { note: unknown }).note
                            )}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Notes */}
          {adminNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  Admin Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {note.admin?.name || "Admin"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(note.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">
                        {note.details &&
                        typeof note.details === "object" &&
                        "note" in note.details
                          ? String(note.details.note)
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions */}
        <div>
          <UserActionsClient
            userId={userData.id}
            userName={userData.name || userData.email}
            currentRole={userData.profile?.platformRole || "user"}
            isDeleted={!!userData.profile?.deletedAt}
            isCurrentUser={isCurrentUser}
          />
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    user: "outline",
    platform_admin: "secondary",
    super_admin: "default",
  };

  const labels: Record<string, string> = {
    user: "User",
    platform_admin: "Platform Admin",
    super_admin: "Super Admin",
  };

  return (
    <Badge variant={variants[role] || "outline"} className="text-sm">
      {labels[role] || role}
    </Badge>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <Badge variant="default" className="text-sm">
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-sm">
      Unverified
    </Badge>
  );
}

function StoreBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    pending_review: "secondary",
    suspended: "destructive",
    inactive: "outline",
  };

  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {status.replace("_", " ")}
    </Badge>
  );
}

function SubscriptionBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    cancelled: "outline",
    expired: "destructive",
  };

  const labels: Record<string, string> = {
    active: "Paid",
    trialing: "Trial",
    past_due: "Past Due",
    cancelled: "Cancelled",
    expired: "Expired",
  };

  return (
    <Badge variant={variants[status] || "outline"} className="text-xs">
      {labels[status] || status}
    </Badge>
  );
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    "user.role.update": "Role changed",
    "user.soft_delete": "Account deleted",
    "user.restore": "Account restored",
    "user.note": "Note added",
  };

  return labels[action] || action.replace(/\./g, " ");
}
