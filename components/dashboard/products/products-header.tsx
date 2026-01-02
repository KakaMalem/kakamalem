"use client";

import {
  Package,
  CheckCircle,
  FileText,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProductsHeaderProps {
  counts: {
    total: number;
    active: number;
    draft: number;
    lowStock: number;
    outOfStock: number;
  };
}

export function ProductsHeader({ counts }: ProductsHeaderProps) {
  const stats = [
    {
      label: "Total Products",
      value: counts.total,
      icon: Package,
      color: "text-foreground",
    },
    {
      label: "Active",
      value: counts.active,
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: "Draft",
      value: counts.draft,
      icon: FileText,
      color: "text-muted-foreground",
    },
    {
      label: "Low Stock",
      value: counts.lowStock,
      icon: AlertTriangle,
      color: "text-yellow-600",
    },
    {
      label: "Out of Stock",
      value: counts.outOfStock,
      icon: XCircle,
      color: "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <stat.icon className={`size-5 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
