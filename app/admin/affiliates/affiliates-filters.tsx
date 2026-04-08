"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AffiliatesFiltersProps {
  initialSearch: string;
  initialStatus: string;
  initialTier: string;
}

export function AffiliatesFilters({
  initialSearch,
  initialStatus,
  initialTier,
}: AffiliatesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);

  const updateFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when filters change
    params.delete("page");

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    startTransition(() => {
      router.push(`/admin/affiliates?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search });
  };

  const clearFilters = () => {
    setSearch("");
    startTransition(() => {
      router.push("/admin/affiliates");
    });
  };

  const hasFilters = initialSearch || initialStatus || initialTier;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or email..."
            className="pl-10"
            disabled={isPending}
          />
        </div>
      </form>

      {/* Status Filter */}
      <Select
        value={initialStatus || "all"}
        onValueChange={(value) => updateFilters({ status: value })}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-37.5">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {/* Tier Filter */}
      <Select
        value={initialTier || "all"}
        onValueChange={(value) => updateFilters({ tier: value })}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-32.5">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tiers</SelectItem>
          <SelectItem value="bronze">Bronze</SelectItem>
          <SelectItem value="silver">Silver</SelectItem>
          <SelectItem value="gold">Gold</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          onClick={clearFilters}
          disabled={isPending}
          className="gap-2"
        >
          <X className="size-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
