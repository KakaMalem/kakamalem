"use client";
"use no memo";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  History,
  BarChart3,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { InventoryProduct } from "@/lib/db/queries/inventory";
import { QuickAdjustDialog } from "./quick-adjust-dialog";

interface InventoryDataTableProps {
  data: InventoryProduct[];
  tenantId: string;
  storeSlug: string;
  currency: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
}

function formatCurrency(value: number, currency: string): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M ${currency}`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K ${currency}`;
  }
  return `${value.toLocaleString()} ${currency}`;
}

function StockStatusBadge({
  status,
  stock,
  lowThreshold,
}: {
  status: "in_stock" | "low_stock" | "out_of_stock";
  stock: number;
  lowThreshold: number;
}) {
  if (status === "out_of_stock") {
    return (
      <Badge variant="destructive" className="gap-1">
        <PackageX className="size-3" />
        Out of Stock
      </Badge>
    );
  }
  if (status === "low_stock") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1 border-yellow-500 text-yellow-600"
            >
              <AlertTriangle className="size-3" />
              Low Stock
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {stock} units remaining (threshold: {lowThreshold})
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
      <PackageCheck className="size-3" />
      In Stock
    </Badge>
  );
}

export function InventoryDataTable({
  data,
  tenantId,
  storeSlug,
  currency,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSelectionChange,
}: InventoryDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<{
    id: string;
    name: string;
    stock: number;
    hasVariants: boolean;
  } | null>(null);

  // Notify parent of selection changes
  const handleRowSelectionChange = useCallback(
    (
      updater:
        | RowSelectionState
        | ((old: RowSelectionState) => RowSelectionState)
    ) => {
      setRowSelection((old) => {
        const newSelection =
          typeof updater === "function" ? updater(old) : updater;
        if (onSelectionChange) {
          const selectedIds = Object.keys(newSelection).filter(
            (key) => newSelection[key]
          );
          const selectedProductIds = selectedIds
            .map((idx) => data[parseInt(idx)]?.id)
            .filter(Boolean);
          onSelectionChange(selectedProductIds as string[]);
        }
        return newSelection;
      });
    },
    [data, onSelectionChange]
  );

  const columns: ColumnDef<InventoryProduct>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Product
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 size-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 size-4" />
            ) : (
              <ArrowUpDown className="ml-2 size-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/dashboard/${storeSlug}/products/${product.id}`}
                className="font-medium hover:underline"
              >
                {product.name}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {product.sku && <span>SKU: {product.sku}</span>}
                {product.hasVariants && (
                  <Badge variant="secondary" className="h-4 gap-1 px-1 text-xs">
                    <Layers className="size-2.5" />
                    {product.variantCount} variants
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.getValue("categoryName") || "Uncategorized"}
          </span>
        ),
      },
      {
        accessorKey: "stock",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Stock
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 size-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 size-4" />
            ) : (
              <ArrowUpDown className="ml-2 size-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium tabular-nums">
                {product.stock.toLocaleString()}
              </span>
              {product.reservedStock > 0 && (
                <span className="text-xs text-muted-foreground">
                  {product.availableStock.toLocaleString()} available
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "stockStatus",
        header: "Status",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <StockStatusBadge
              status={product.stockStatus}
              stock={product.stock}
              lowThreshold={product.lowStockThreshold}
            />
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "stockValue",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Value
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 size-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 size-4" />
            ) : (
              <ArrowUpDown className="ml-2 size-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => formatCurrency(row.getValue("stockValue"), currency),
      },
      {
        accessorKey: "lastMovementDate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4"
          >
            Last Activity
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 size-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 size-4" />
            ) : (
              <ArrowUpDown className="ml-2 size-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const dateStr = row.getValue("lastMovementDate") as string | null;
          if (!dateStr) {
            return <span className="text-muted-foreground">No activity</span>;
          }
          const date = new Date(dateStr);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(date, { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{format(date, "PPpp")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const product = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="size-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {product.hasVariants ? (
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/dashboard/${storeSlug}/inventory/adjust?productId=${product.id}`}
                    >
                      <Pencil className="mr-2 size-4" />
                      Adjust Stock
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() =>
                      setQuickAdjustProduct({
                        id: product.id,
                        name: product.name,
                        stock: product.stock,
                        hasVariants: false,
                      })
                    }
                  >
                    <Pencil className="mr-2 size-4" />
                    Adjust Stock
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/${storeSlug}/inventory/history?productId=${product.id}`}
                  >
                    <History className="mr-2 size-4" />
                    View History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/${storeSlug}/products/${product.id}`}>
                    <Package className="mr-2 size-4" />
                    Edit Product
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/${storeSlug}/analytics?productId=${product.id}`}
                  >
                    <BarChart3 className="mr-2 size-4" />
                    View Analytics
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        size: 50,
      },
    ],
    [storeSlug, currency]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: handleRowSelectionChange,
    state: {
      sorting,
      rowSelection,
    },
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  const selectedCount = Object.keys(rowSelection).filter(
    (key) => rowSelection[key]
  ).length;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Package className="size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No inventory items found.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {selectedCount > 0 && <span>{selectedCount} row(s) selected</span>}
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} products
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={String(pagination.limit)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-25">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(1)}
              disabled={pagination.page === 1}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="mx-2 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Adjust Dialog */}
      {quickAdjustProduct && (
        <QuickAdjustDialog
          open={!!quickAdjustProduct}
          onOpenChange={(open) => !open && setQuickAdjustProduct(null)}
          tenantId={tenantId}
          productId={quickAdjustProduct.id}
          productName={quickAdjustProduct.name}
          currentStock={quickAdjustProduct.stock}
        />
      )}
    </>
  );
}
