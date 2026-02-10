"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MapPin, ArrowUpDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MarketplaceFiltersProps {
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    storeCount: number;
  }>;
  cities: string[];
  activeCategory?: string;
  activeCity?: string;
  activeSort?: string;
}

export function MarketplaceFilters({
  categories,
  cities,
  activeCategory,
  activeCity,
  activeSort,
}: MarketplaceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");

    startTransition(() => {
      router.push(`/marketplace?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => updateParam("category", null)}
            disabled={isPending}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !activeCategory
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All Stores
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                updateParam(
                  "category",
                  activeCategory === cat.id ? null : cat.id
                )
              }
              disabled={isPending}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeCategory === cat.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat.icon && <span className="mr-0.5">{cat.icon}</span>}
              {cat.name}
              {cat.storeCount > 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  {cat.storeCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* City + Sort row */}
      <div className="flex flex-wrap items-center gap-2">
        {cities.length > 0 && (
          <Select
            value={activeCity ?? "__all__"}
            onValueChange={(value) =>
              updateParam("city", value === "__all__" ? null : value)
            }
            disabled={isPending}
          >
            <SelectTrigger size="sm" className="h-8 gap-1.5 text-xs">
              <MapPin className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={activeSort ?? "recommended"}
          onValueChange={(value) => updateParam("sort", value)}
          disabled={isPending}
        >
          <SelectTrigger size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="popular">Most Popular</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name">A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
