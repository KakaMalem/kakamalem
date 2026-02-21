"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LayoutGrid, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionMetric {
  sectionType: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

interface SectionEngagementCardProps {
  data: SectionMetric[];
}

type SortField = "sectionType" | "impressions" | "clicks" | "ctr";

function SortButton({
  field,
  activeField,
  onToggle,
  children,
}: {
  field: SortField;
  activeField: SortField;
  onToggle: (field: SortField) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=active]:font-bold"
      data-state={activeField === field ? "active" : undefined}
      onClick={() => onToggle(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 size-3" />
    </Button>
  );
}

export function SectionEngagementCard({ data }: SectionEngagementCardProps) {
  const [sortField, setSortField] = useState<SortField>("impressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return sortDir === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="size-4" />
          Section Engagement
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No section engagement data yet. Visit your storefront to start
            tracking.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton
                    field="sectionType"
                    activeField={sortField}
                    onToggle={toggleSort}
                  >
                    Section
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="impressions"
                    activeField={sortField}
                    onToggle={toggleSort}
                  >
                    Impressions
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="clicks"
                    activeField={sortField}
                    onToggle={toggleSort}
                  >
                    Clicks
                  </SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton
                    field="ctr"
                    activeField={sortField}
                    onToggle={toggleSort}
                  >
                    CTR
                  </SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.sectionType}>
                  <TableCell className="font-medium">
                    {formatSectionName(row.sectionType)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ctr}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Convert PascalCase section type to human-readable name */
function formatSectionName(type: string): string {
  return type.replace(/([A-Z])/g, " $1").trim();
}
