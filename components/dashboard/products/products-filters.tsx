"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Upload,
  Download,
  MoreVertical,
  ShoppingBag,
  Package,
  Bot,
  FileSpreadsheet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductsFiltersProps {
  showArchived: boolean;
  currentSort?: { field: string; direction: string };
  storeSlug: string;
  onBulkUploadClick?: () => void;
}

export function ProductsFilters({
  showArchived,
  storeSlug,
  onBulkUploadClick,
}: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    const currentLimit = searchParams.get("limit");
    if (currentLimit && currentLimit !== "25")
      params.set("limit", currentLimit);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => {
      router.push(`/dashboard/${storeSlug}/products?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: search || undefined });
  };

  const handleToggle = (archived: boolean) => {
    updateParams({ status: archived ? "archived" : undefined });
  };

  // All import sources shown directly — no nesting
  const importSources = [
    {
      label: "AliExpress",
      description: "Scrape any AliExpress product URL",
      Icon: ShoppingBag,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-50",
      href: `/dashboard/${storeSlug}/products/import?tab=aliexpress`,
      href_defined: true,
    },
    {
      label: "Amazon",
      description: "Import from Amazon product URL",
      Icon: Package,
      iconColor: "text-sky-500",
      iconBg: "bg-sky-50",
      href: `/dashboard/${storeSlug}/products/import?tab=amazon`,
      href_defined: true,
    },
    {
      label: "AutoDS",
      description: "Sync products via AutoDS API key",
      Icon: Bot,
      iconColor: "text-violet-500",
      iconBg: "bg-violet-50",
      href: `/dashboard/${storeSlug}/settings/integrations`,
      href_defined: true,
    },
    {
      label: "CSV / Excel / ZIP",
      description: "Bulk upload from a spreadsheet",
      Icon: FileSpreadsheet,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-50",
      href: undefined as string | undefined,
      href_defined: false,
      action: onBulkUploadClick,
    },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>

        {/* Active / Archived toggle */}
        <div className="relative z-0 inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => handleToggle(false)}
            disabled={isPending}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              !showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true)}
            disabled={isPending}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              showArchived
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Archived
          </button>
        </div>

        {/* Mobile overflow */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 sm:hidden"
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs uppercase tracking-wider">
              Import from
            </DropdownMenuLabel>
            {importSources.map((src) =>
              src.href ? (
                <DropdownMenuItem key={src.label} asChild>
                  <Link href={src.href} className="flex items-center gap-2.5">
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-md ${src.iconBg} shrink-0`}
                    >
                      <src.Icon className={`h-3.5 w-3.5 ${src.iconColor}`} />
                    </span>
                    <span className="text-sm">{src.label}</span>
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={src.label}
                  onClick={src.action}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-md ${src.iconBg} shrink-0`}
                  >
                    <src.Icon className={`h-3.5 w-3.5 ${src.iconColor}`} />
                  </span>
                  <span className="text-sm">{src.label}</span>
                </DropdownMenuItem>
              )
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wider">
              Export
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=csv${showArchived ? "&status=archived" : ""}`}
                download
                className="flex items-center gap-2"
              >
                <Download className="size-4" /> Export as CSV
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=xlsx${showArchived ? "&status=archived" : ""}`}
                download
                className="flex items-center gap-2"
              >
                <Download className="size-4" /> Export as Excel
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop buttons */}
      <div className="hidden sm:flex items-center gap-2">
        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=csv${showArchived ? "&status=archived" : ""}`}
                download
              >
                Export as CSV
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/dashboard/${storeSlug}/products/export?format=xlsx${showArchived ? "&status=archived" : ""}`}
                download
              >
                Export as Excel
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Import — all sources visible directly, with descriptions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="size-4" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground pb-1">
              Choose a source
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {importSources.map((src) =>
              src.href ? (
                <DropdownMenuItem key={src.label} asChild className="py-2">
                  <Link href={src.href}>
                    <div className="flex items-start gap-3 w-full">
                      <span
                        className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${src.iconBg} shrink-0 mt-0.5`}
                      >
                        <src.Icon className={`h-4 w-4 ${src.iconColor}`} />
                      </span>
                      <div>
                        <p className="font-medium text-sm leading-tight">
                          {src.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {src.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={src.label}
                  onClick={"action" in src ? src.action : undefined}
                  className="py-2 cursor-pointer"
                >
                  <div className="flex items-start gap-3 w-full">
                    <span
                      className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${src.iconBg} shrink-0 mt-0.5`}
                    >
                      <src.Icon className={`h-4 w-4 ${src.iconColor}`} />
                    </span>
                    <div>
                      <p className="font-medium text-sm leading-tight">
                        {src.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {src.description}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild>
          <Link href={`/dashboard/${storeSlug}/products/new`}>
            <Plus className="size-4" />
            Add Product
          </Link>
        </Button>
      </div>
    </div>
  );
}
