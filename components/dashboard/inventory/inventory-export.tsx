"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { InventoryProduct } from "@/lib/db/queries/inventory";

interface InventoryExportProps {
  products: InventoryProduct[];
  currency: string;
  storeName?: string;
}

export function InventoryExport({
  products,
  currency,
  storeName = "Store",
}: InventoryExportProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const formatDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const prepareExportData = () => {
    return products.map((p) => ({
      "Product Name": p.name,
      SKU: p.sku || "",
      Barcode: p.barcode || "",
      Category: p.categoryName || "Uncategorized",
      "Current Stock": p.stock,
      "Reserved Stock": p.reservedStock,
      "Available Stock": p.availableStock,
      "Low Stock Threshold": p.lowStockThreshold,
      "Stock Status": p.stockStatus.replace("_", " ").toUpperCase(),
      "Unit Price": `${p.price} ${currency}`,
      "Stock Value": `${p.stockValue.toLocaleString()} ${currency}`,
      "Has Variants": p.hasVariants ? "Yes" : "No",
      "Variant Count": p.hasVariants ? p.variantCount : "N/A",
      "Allow Backorder": p.allowBackorder ? "Yes" : "No",
      "Last Movement": p.lastMovementDate
        ? new Date(p.lastMovementDate).toLocaleString()
        : "No activity",
    }));
  };

  const exportToCSV = async () => {
    setIsExporting("csv");
    try {
      const data = prepareExportData();

      // Convert to CSV
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row];
              // Escape quotes and wrap in quotes if contains comma
              const stringValue = String(value);
              if (stringValue.includes(",") || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(",")
        ),
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storeName.replace(/\s+/g, "-")}-inventory-${formatDate()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("Inventory exported to CSV");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export inventory");
    } finally {
      setIsExporting(null);
    }
  };

  const exportToExcel = async () => {
    setIsExporting("excel");
    try {
      const data = prepareExportData();

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Set column widths
      const columnWidths = [
        { wch: 30 }, // Product Name
        { wch: 15 }, // SKU
        { wch: 15 }, // Barcode
        { wch: 20 }, // Category
        { wch: 12 }, // Current Stock
        { wch: 14 }, // Reserved Stock
        { wch: 14 }, // Available Stock
        { wch: 18 }, // Low Stock Threshold
        { wch: 14 }, // Stock Status
        { wch: 15 }, // Unit Price
        { wch: 18 }, // Stock Value
        { wch: 12 }, // Has Variants
        { wch: 12 }, // Variant Count
        { wch: 14 }, // Allow Backorder
        { wch: 20 }, // Last Movement
      ];
      worksheet["!cols"] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

      // Create summary sheet
      const summaryData = [
        { Metric: "Total Products", Value: products.length },
        {
          Metric: "In Stock",
          Value: products.filter((p) => p.stockStatus === "in_stock").length,
        },
        {
          Metric: "Low Stock",
          Value: products.filter((p) => p.stockStatus === "low_stock").length,
        },
        {
          Metric: "Out of Stock",
          Value: products.filter((p) => p.stockStatus === "out_of_stock")
            .length,
        },
        {
          Metric: "Total Units",
          Value: products.reduce((sum, p) => sum + p.stock, 0),
        },
        {
          Metric: "Total Value",
          Value: `${products.reduce((sum, p) => sum + p.stockValue, 0).toLocaleString()} ${currency}`,
        },
        { Metric: "Export Date", Value: new Date().toLocaleString() },
      ];
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      summaryWorksheet["!cols"] = [{ wch: 20 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

      // Generate file and download
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storeName.replace(/\s+/g, "-")}-inventory-${formatDate()}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("Inventory exported to Excel");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export inventory");
    } finally {
      setIsExporting(null);
    }
  };

  const exportToJSON = async () => {
    setIsExporting("json");
    try {
      const exportData = {
        storeName,
        exportDate: new Date().toISOString(),
        currency,
        summary: {
          totalProducts: products.length,
          inStock: products.filter((p) => p.stockStatus === "in_stock").length,
          lowStock: products.filter((p) => p.stockStatus === "low_stock")
            .length,
          outOfStock: products.filter((p) => p.stockStatus === "out_of_stock")
            .length,
          totalUnits: products.reduce((sum, p) => sum + p.stock, 0),
          totalValue: products.reduce((sum, p) => sum + p.stockValue, 0),
        },
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.categoryName,
          stock: p.stock,
          reservedStock: p.reservedStock,
          availableStock: p.availableStock,
          lowStockThreshold: p.lowStockThreshold,
          stockStatus: p.stockStatus,
          price: parseFloat(p.price),
          stockValue: p.stockValue,
          hasVariants: p.hasVariants,
          variantCount: p.variantCount,
          allowBackorder: p.allowBackorder,
          lastMovementDate: p.lastMovementDate,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storeName.replace(/\s+/g, "-")}-inventory-${formatDate()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("Inventory exported to JSON");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export inventory");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={products.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={exportToExcel}
          disabled={isExporting !== null}
        >
          <FileSpreadsheet className="mr-2 size-4 text-green-600" />
          Excel (.xlsx)
          {isExporting === "excel" && (
            <Loader2 className="ml-auto size-4 animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV} disabled={isExporting !== null}>
          <FileText className="mr-2 size-4 text-blue-600" />
          CSV (.csv)
          {isExporting === "csv" && (
            <Loader2 className="ml-auto size-4 animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportToJSON}
          disabled={isExporting !== null}
        >
          <FileText className="mr-2 size-4 text-orange-600" />
          JSON (.json)
          {isExporting === "json" && (
            <Loader2 className="ml-auto size-4 animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HistoryExportProps {
  movements: Array<{
    id: string;
    productName: string;
    variantDisplayName?: string | null;
    type: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    userName?: string | null;
    reason?: string | null;
    createdAt: string;
  }>;
  storeName?: string;
}

export function HistoryExport({
  movements,
  storeName = "Store",
}: HistoryExportProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const formatDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const exportToCSV = async () => {
    setIsExporting("csv");
    try {
      const data = movements.map((m) => ({
        Date: new Date(m.createdAt).toLocaleString(),
        Product: m.productName,
        Variant: m.variantDisplayName || "",
        Type: m.type.charAt(0).toUpperCase() + m.type.slice(1),
        Quantity: m.quantity > 0 ? `+${m.quantity}` : m.quantity,
        "Previous Stock": m.previousStock,
        "New Stock": m.newStock,
        "Changed By": m.userName || "System",
        Reason: m.reason || "",
      }));

      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row];
              const stringValue = String(value);
              if (stringValue.includes(",") || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storeName.replace(/\s+/g, "-")}-inventory-history-${formatDate()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("History exported to CSV");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export history");
    } finally {
      setIsExporting(null);
    }
  };

  const exportToExcel = async () => {
    setIsExporting("excel");
    try {
      const data = movements.map((m) => ({
        Date: new Date(m.createdAt).toLocaleString(),
        Product: m.productName,
        Variant: m.variantDisplayName || "",
        Type: m.type.charAt(0).toUpperCase() + m.type.slice(1),
        Quantity: m.quantity,
        "Previous Stock": m.previousStock,
        "New Stock": m.newStock,
        "Changed By": m.userName || "System",
        Reason: m.reason || "",
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);

      worksheet["!cols"] = [
        { wch: 20 }, // Date
        { wch: 30 }, // Product
        { wch: 20 }, // Variant
        { wch: 12 }, // Type
        { wch: 10 }, // Quantity
        { wch: 14 }, // Previous Stock
        { wch: 12 }, // New Stock
        { wch: 20 }, // Changed By
        { wch: 30 }, // Reason
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Movement History");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storeName.replace(/\s+/g, "-")}-inventory-history-${formatDate()}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success("History exported to Excel");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export history");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={movements.length === 0}>
          {isExporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={exportToExcel}
          disabled={isExporting !== null}
        >
          <FileSpreadsheet className="mr-2 size-4 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV} disabled={isExporting !== null}>
          <FileText className="mr-2 size-4 text-blue-600" />
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
