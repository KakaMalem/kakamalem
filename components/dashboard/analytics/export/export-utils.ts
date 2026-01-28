import { toPng } from "html-to-image";
import * as XLSX from "xlsx";

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) return;

  // Get column headers
  const headers = columns
    ? columns.map((col) => col.label)
    : Object.keys(data[0]);

  // Get column keys
  const keys = columns
    ? columns.map((col) => col.key as string)
    : Object.keys(data[0]);

  // Build CSV content
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      keys
        .map((key) => {
          const value = row[key];
          // Handle values that might contain commas
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value ?? "";
        })
        .join(",")
    ),
  ].join("\n");

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to Excel file
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  sheetName: string = "Data"
) {
  if (data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export a chart/element to PNG image
 */
export async function exportChartToPNG(
  elementId: string,
  filename: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  try {
    const dataUrl = await toPng(element, {
      backgroundColor: "#ffffff",
      quality: 1.0,
      pixelRatio: 2,
    });

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Failed to export chart:", error);
  }
}

/**
 * Format date for filename
 */
export function formatDateForFilename(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * Generate analytics export filename
 */
export function generateAnalyticsFilename(
  type: string,
  storeSlug: string
): string {
  return `${storeSlug}-${type}-${formatDateForFilename()}`;
}
