import Link from "next/link";
import { getAdminUsers } from "@/lib/db/queries/admin-users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Store,
} from "lucide-react";
import { UsersFilters } from "./users-filters";

// =============================================================================
// ADMIN USERS LIST
// =============================================================================
// List all users with filtering and pagination
// =============================================================================

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    verified?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const role = params.role || "";
  const verified = params.verified || "";

  // Build filter options
  const roleFilter =
    role && role !== "all"
      ? (role as "user" | "platform_admin" | "super_admin")
      : undefined;

  const verifiedFilter =
    verified === "true" ? true : verified === "false" ? false : undefined;

  const { users, pagination } = await getAdminUsers({
    page,
    limit: 20,
    search: search || undefined,
    platformRole: roleFilter,
    emailVerified: verifiedFilter,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage all users on the platform
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <UsersFilters
            initialSearch={search}
            initialRole={role}
            initialVerified={verified}
          />
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            {pagination.total} Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Stores</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow
                    key={u.id}
                    className={u.profile?.deletedAt ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={u.image || undefined} />
                          <AvatarFallback>
                            {getInitials(u.name || u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{u.name || "—"}</p>
                            {u.profile?.deletedAt && (
                              <Badge variant="destructive" className="text-xs">
                                Deleted
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.profile?.platformRole || "user"} />
                    </TableCell>
                    <TableCell>
                      <VerifiedBadge verified={u.emailVerified} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Store className="size-3.5" />
                        <span>{u.storesOwned + u.storesMemberOf}</span>
                        {u.storesOwned > 0 && (
                          <span className="text-xs">
                            ({u.storesOwned} owned)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Link
                  href={buildUrl({
                    page: pagination.page - 1,
                    search,
                    role,
                    verified,
                  })}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Previous
                  </Button>
                </Link>
                <Link
                  href={buildUrl({
                    page: pagination.page + 1,
                    search,
                    role,
                    verified,
                  })}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
    <Badge variant={variants[role] || "outline"}>{labels[role] || role}</Badge>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <div className="flex items-center gap-1 text-green-600">
      <CheckCircle className="size-4" />
      <span className="text-xs">Verified</span>
    </div>
  ) : (
    <div className="flex items-center gap-1 text-muted-foreground">
      <XCircle className="size-4" />
      <span className="text-xs">Unverified</span>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildUrl(params: {
  page: number;
  search: string;
  role: string;
  verified: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.page > 1) urlParams.set("page", String(params.page));
  if (params.search) urlParams.set("search", params.search);
  if (params.role && params.role !== "all") {
    urlParams.set("role", params.role);
  }
  if (params.verified && params.verified !== "all") {
    urlParams.set("verified", params.verified);
  }
  const query = urlParams.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}
