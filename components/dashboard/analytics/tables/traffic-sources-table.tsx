"use client";
"use no memo";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrafficSourceData } from "@/lib/db/queries/analytics";

interface TrafficSourcesTableProps {
  data: TrafficSourceData[];
  currency: string;
  isLoading?: boolean;
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

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function getSourceBadgeVariant(
  source: string
): "default" | "secondary" | "outline" {
  const normalizedSource = source.toLowerCase();
  if (normalizedSource === "direct") return "default";
  if (["google", "bing", "yahoo"].includes(normalizedSource))
    return "secondary";
  return "outline";
}

export function TrafficSourcesTable({
  data,
  currency,
  isLoading = false,
}: TrafficSourcesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "revenue", desc: true },
  ]);

  const columns: ColumnDef<TrafficSourceData>[] = [
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <Badge variant={getSourceBadgeVariant(row.getValue("source"))}>
          {row.getValue("source")}
        </Badge>
      ),
    },
    {
      accessorKey: "medium",
      header: "Medium",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.getValue("medium") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "campaign",
      header: "Campaign",
      cell: ({ row }) => (
        <span className="text-muted-foreground max-w-32 truncate">
          {row.getValue("campaign") || "-"}
        </span>
      ),
    },
    {
      accessorKey: "visitors",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Visitors
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : (
            <ArrowUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatNumber(row.getValue("visitors")),
    },
    {
      accessorKey: "orders",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Orders
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : (
            <ArrowUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatNumber(row.getValue("orders")),
    },
    {
      accessorKey: "revenue",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Revenue
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 size-4" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 size-4" />
          ) : (
            <ArrowUpDown className="ml-2 size-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatCurrency(row.getValue("revenue"), currency),
    },
    {
      accessorKey: "conversionRate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Conv. Rate
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
        const rate = row.getValue("conversionRate") as number;
        return `${rate.toFixed(2)}%`;
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No traffic data available.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                    <TableRow key={row.id}>
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
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
