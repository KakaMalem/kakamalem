"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { parseFileForPreview, importProducts } from "@/lib/actions/bulk-upload";
import type {
  ValidatedRow,
  BulkUploadResult,
  ProductLimitInfo,
} from "@/lib/validations/bulk-upload";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  tenantId: string;
}

type UploadStep = "upload" | "preview" | "importing" | "complete";

export function BulkUploadDialog({
  open,
  onOpenChange,
  storeSlug,
  tenantId,
}: BulkUploadDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>("upload");
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [productLimitInfo, setProductLimitInfo] =
    useState<ProductLimitInfo | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<BulkUploadResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setParseError(null);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await parseFileForPreview(
          tenantId,
          arrayBuffer,
          file.name
        );

        if (result.success && result.rows) {
          setValidatedRows(result.rows);
          setProductLimitInfo(result.productLimitInfo || null);
          setStep("preview");
        } else {
          setParseError(result.error || "Failed to parse file");
        }
      } catch {
        setParseError("Failed to read file");
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId]
  );

  const handleImport = useCallback(async () => {
    const rowsToImport = validatedRows.filter((r) => r.isValid);
    if (rowsToImport.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setStep("importing");
    setImportProgress(0);

    // Simulate progress (actual progress would require streaming)
    const progressInterval = setInterval(() => {
      setImportProgress((p) => Math.min(p + 10, 90));
    }, 200);

    try {
      const result = await importProducts(tenantId, validatedRows);
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setStep("complete");

      if (result.success && result.importedCount === result.validRows) {
        toast.success(`Successfully imported ${result.importedCount} products`);
        router.refresh();
      } else if (result.importedCount > 0) {
        toast.warning(
          `Imported ${result.importedCount} products with some errors`
        );
        router.refresh();
      } else {
        toast.error("Import failed");
      }
    } catch {
      clearInterval(progressInterval);
      toast.error("Import failed");
      setStep("preview");
    }
  }, [validatedRows, tenantId, router]);

  const handleClose = useCallback(() => {
    setStep("upload");
    setValidatedRows([]);
    setProductLimitInfo(null);
    setImportProgress(0);
    setImportResult(null);
    setParseError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile &&
        (droppedFile.name.endsWith(".csv") ||
          droppedFile.name.endsWith(".xlsx") ||
          droppedFile.name.endsWith(".xls"))
      ) {
        handleFileSelect(droppedFile);
      } else {
        setParseError("Please upload a CSV or Excel file (.csv, .xlsx)");
      }
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.filter((r) => !r.isValid).length;
  const warningCount = validatedRows.filter(
    (r) => r.isValid && r.warnings.length > 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import Products"}
            {step === "preview" && "Review Import"}
            {step === "importing" && "Importing Products..."}
            {step === "complete" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV or Excel file to bulk import products"}
            {step === "preview" &&
              `${validCount} valid, ${invalidCount} with errors`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById("file-input")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleInputChange}
              />
              <Upload className="mx-auto size-12 text-muted-foreground mb-4" />
              <p className="font-medium">Drop file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                CSV or Excel (.xlsx), max 500 products, 2MB
              </p>
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Validating file...
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href={`/api/dashboard/${storeSlug}/products/bulk-upload/template?format=csv`}
                  download
                >
                  <Download className="mr-2 size-4" />
                  CSV Template
                </a>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href={`/api/dashboard/${storeSlug}/products/bulk-upload/template?format=xlsx`}
                  download
                >
                  <FileSpreadsheet className="mr-2 size-4" />
                  Excel Template
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {productLimitInfo && productLimitInfo.limit !== null && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>Product Limit</AlertTitle>
                <AlertDescription>
                  You have {productLimitInfo.currentCount} of{" "}
                  {productLimitInfo.limit} products.
                  {productLimitInfo.canImport < validCount && (
                    <>
                      {" "}
                      Only {productLimitInfo.canImport} products can be
                      imported.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span>{validCount} valid</span>
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-yellow-600" />
                  <span>{warningCount} with warnings</span>
                </div>
              )}
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-destructive" />
                  <span>{invalidCount} with errors</span>
                </div>
              )}
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-16">Row</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left w-24">Price</th>
                    <th className="p-2 text-left w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        !row.isValid
                          ? "bg-destructive/5"
                          : row.warnings.length > 0
                            ? "bg-yellow-500/5"
                            : ""
                      }
                    >
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">
                            {row.data.name}
                          </span>
                          {!row.isValid && (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          )}
                          {row.isValid && row.warnings.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs text-yellow-600"
                            >
                              Warning
                            </Badge>
                          )}
                        </div>
                        {row.errors.length > 0 && (
                          <p className="text-xs text-destructive mt-1">
                            {row.errors[0]}
                          </p>
                        )}
                        {row.warnings.length > 0 && row.errors.length === 0 && (
                          <p className="text-xs text-yellow-600 mt-1">
                            {row.warnings[0]}
                          </p>
                        )}
                      </td>
                      <td className="p-2">{row.data.price}</td>
                      <td className="p-2">{row.data.status || "draft"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="space-y-4 py-8">
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              Importing products... {importProgress}%
            </p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              {importResult.importedCount > 0 ? (
                <CheckCircle2 className="mx-auto size-12 text-green-600 mb-4" />
              ) : (
                <AlertCircle className="mx-auto size-12 text-destructive mb-4" />
              )}
              <p className="font-medium">
                {importResult.importedCount} of {importResult.totalRows}{" "}
                products imported
              </p>
            </div>

            {importResult.errors.length > 0 && (
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <h4 className="font-medium mb-2">Errors:</h4>
                {importResult.errors.slice(0, 50).map((err, i) => (
                  <div key={i} className="text-sm text-destructive mb-1">
                    Row {err.row}: {err.errors.join(", ")}
                  </div>
                ))}
                {importResult.errors.length > 50 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    And {importResult.errors.length - 50} more errors...
                  </p>
                )}
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Import {validCount} Products
              </Button>
            </>
          )}
          {step === "complete" && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
