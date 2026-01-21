"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useState } from "react";

// =============================================================================
// USERS FILTERS (Client Component)
// =============================================================================
// Handles search and filtering with proper hydration
// =============================================================================

interface UsersFiltersProps {
  initialSearch: string;
  initialRole: string;
  initialVerified: string;
}

export function UsersFilters({
  initialSearch,
  initialRole,
  initialVerified,
}: UsersFiltersProps) {
  const router = useRouter();

  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState(initialRole || "all");
  const [verified, setVerified] = useState(initialVerified || "all");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (role && role !== "all") params.set("role", role);
    if (verified && verified !== "all") params.set("verified", verified);

    const query = params.toString();
    router.push(`/admin/users${query ? `?${query}` : ""}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      {/* Search */}
      <div className="relative min-w-50 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Role Filter */}
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="platform_admin">Platform Admin</SelectItem>
          <SelectItem value="super_admin">Super Admin</SelectItem>
        </SelectContent>
      </Select>

      {/* Email Verified Filter */}
      <Select value={verified} onValueChange={setVerified}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All users" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All users</SelectItem>
          <SelectItem value="true">Verified</SelectItem>
          <SelectItem value="false">Unverified</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit">Filter</Button>
    </form>
  );
}
