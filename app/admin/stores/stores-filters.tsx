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
// STORES FILTERS (Client Component)
// =============================================================================
// Handles search and filtering with proper hydration
// =============================================================================

interface StoresFiltersProps {
  initialSearch: string;
  initialStatus: string;
  initialSubscriptionStatus: string;
}

export function StoresFilters({
  initialSearch,
  initialStatus,
  initialSubscriptionStatus,
}: StoresFiltersProps) {
  const router = useRouter();

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus || "all");
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    initialSubscriptionStatus || "all"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    if (subscriptionStatus && subscriptionStatus !== "all") {
      params.set("subscriptionStatus", subscriptionStatus);
    }

    const query = params.toString();
    router.push(`/admin/stores${query ? `?${query}` : ""}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
      {/* Search */}
      <div className="relative min-w-50 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search stores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Status Filter */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending_review">Pending Review</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Subscription Status Filter */}
      <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
        <SelectTrigger className="w-45">
          <SelectValue placeholder="All subscriptions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All subscriptions</SelectItem>
          <SelectItem value="trialing">Trialing</SelectItem>
          <SelectItem value="active">Active (Paid)</SelectItem>
          <SelectItem value="past_due">Past Due</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit">Filter</Button>
    </form>
  );
}
