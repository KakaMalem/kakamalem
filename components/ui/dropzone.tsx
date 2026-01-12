"use client";

import { useState, useRef, useCallback, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  FileImage,
  RotateCcw,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  validateFiles,
  formatFileSize,
  getAcceptString,
  getMaxSize,
  UPLOAD_ERROR_MESSAGES,
} from "@/lib/config/file-validation";

// =============================================================================
// TYPES
// =============================================================================

export interface UploadedFile {
  url: string;
  path: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

export interface UploadState {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  result?: UploadedFile;
}

export interface DropzoneProps {
  tenantId: string;
  folder?: "products" | "media" | "avatars" | "logos" | "documents";
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  onUploadProgress?: (uploads: UploadState[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Show compact version without full drag zone */
  compact?: boolean;
  /** Convert images to WebP on server */
  convertToWebp?: boolean;
  /** Generate thumbnails on server */
  generateThumbnails?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function Dropzone({
  tenantId,
  folder = "media",
  onUploadComplete,
  onUploadError,
  onUploadProgress,
  accept,
  maxFiles = 10,
  maxSize,
  disabled = false,
  className,
  children,
  compact = false,
  convertToWebp = false,
  generateThumbnails = false,
}: DropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const isUploading = uploads.some(
    (u) => u.status === "uploading" || u.status === "pending"
  );
  const effectiveMaxSize = maxSize ?? getMaxSize(folder);
  const effectiveAccept = accept ?? getAcceptString(true);

  // Sync uploads state to parent via useEffect to avoid setState during render
  useEffect(() => {
    onUploadProgress?.(uploads);
  }, [uploads, onUploadProgress]);

  // Upload a single file
  const uploadFile = useCallback(
    async (uploadState: UploadState): Promise<UploadedFile | null> => {
      const formData = new FormData();
      formData.append("file", uploadState.file);
      formData.append("tenantId", tenantId);
      formData.append("folder", folder);
      formData.append("convertToWebp", String(convertToWebp));
      formData.append("generateThumbnails", String(generateThumbnails));

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadState.id
                  ? { ...u, progress, status: "uploading" as const }
                  : u
              )
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as {
                success: boolean;
                file?: UploadedFile;
                error?: string;
              };
              if (response.success && response.file) {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === uploadState.id
                      ? {
                          ...u,
                          progress: 100,
                          status: "complete" as const,
                          result: response.file,
                        }
                      : u
                  )
                );
                resolve(response.file);
              } else {
                // Parse specific error from server response
                let error: string = UPLOAD_ERROR_MESSAGES.unknownError;
                if (response.error) {
                  if (
                    response.error.toLowerCase().includes("too large") ||
                    response.error.toLowerCase().includes("size")
                  ) {
                    error = UPLOAD_ERROR_MESSAGES.fileTooLarge(
                      formatFileSize(effectiveMaxSize)
                    );
                  } else if (
                    response.error.toLowerCase().includes("type") ||
                    response.error.toLowerCase().includes("format")
                  ) {
                    error = UPLOAD_ERROR_MESSAGES.invalidType;
                  } else {
                    error = response.error;
                  }
                }
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === uploadState.id
                      ? { ...u, status: "error" as const, error }
                      : u
                  )
                );
                toast.error(error);
                resolve(null);
              }
            } catch {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadState.id
                    ? {
                        ...u,
                        status: "error" as const,
                        error: UPLOAD_ERROR_MESSAGES.serverError,
                      }
                    : u
                )
              );
              toast.error(UPLOAD_ERROR_MESSAGES.serverError);
              resolve(null);
            }
          } else {
            // HTTP error status codes
            let error: string = UPLOAD_ERROR_MESSAGES.serverError;
            if (xhr.status === 413) {
              error = UPLOAD_ERROR_MESSAGES.fileTooLarge(
                formatFileSize(effectiveMaxSize)
              );
            } else if (xhr.status === 415) {
              error = UPLOAD_ERROR_MESSAGES.invalidType;
            } else if (xhr.status >= 500) {
              error = UPLOAD_ERROR_MESSAGES.serverError;
            } else if (xhr.status === 0) {
              error = UPLOAD_ERROR_MESSAGES.networkError;
            }
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadState.id
                  ? { ...u, status: "error" as const, error }
                  : u
              )
            );
            toast.error(error);
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadState.id
                ? {
                    ...u,
                    status: "error" as const,
                    error: UPLOAD_ERROR_MESSAGES.networkError,
                  }
                : u
            )
          );
          toast.error(UPLOAD_ERROR_MESSAGES.networkError);
          resolve(null);
        });

        xhr.addEventListener("timeout", () => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadState.id
                ? {
                    ...u,
                    status: "error" as const,
                    error: "Upload timed out. Please try again",
                  }
                : u
            )
          );
          toast.error("Upload timed out. Please try again");
          resolve(null);
        });

        xhr.timeout = 120000; // 2 minute timeout per file
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });
    },
    [
      tenantId,
      folder,
      convertToWebp,
      generateThumbnails,
      setUploads,
      effectiveMaxSize,
    ]
  );

  // Process files for upload
  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      // Check max files limit first with clear error message
      if (files.length > maxFiles) {
        toast.error(UPLOAD_ERROR_MESSAGES.tooManyFiles(maxFiles));
        onUploadError?.(UPLOAD_ERROR_MESSAGES.tooManyFiles(maxFiles));
        return;
      }

      // Validate files
      const { valid, invalid } = validateFiles(files, {
        folder,
        imageOnly: true,
        maxSize: effectiveMaxSize,
        maxFiles,
      });

      // Show errors for invalid files with better messages
      for (const { file, error } of invalid) {
        let userFriendlyError = error;
        if (
          error.toLowerCase().includes("less than") ||
          error.toLowerCase().includes("size")
        ) {
          userFriendlyError = UPLOAD_ERROR_MESSAGES.fileTooLarge(
            formatFileSize(effectiveMaxSize)
          );
        } else if (
          error.toLowerCase().includes("type") ||
          error.toLowerCase().includes("extension")
        ) {
          userFriendlyError = UPLOAD_ERROR_MESSAGES.invalidType;
        } else if (
          error.toLowerCase().includes("maximum") &&
          error.toLowerCase().includes("files")
        ) {
          userFriendlyError = UPLOAD_ERROR_MESSAGES.tooManyFiles(maxFiles);
        }
        toast.error(`${file.name}: ${userFriendlyError}`);
      }

      if (valid.length === 0) {
        onUploadError?.("No valid files to upload");
        return;
      }

      // Create upload states
      const newUploads: UploadState[] = valid.map((file) => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        progress: 0,
        status: "pending" as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      // Upload files with concurrency limit (3 at a time)
      const results: UploadedFile[] = [];
      const concurrency = 3;

      for (let i = 0; i < newUploads.length; i += concurrency) {
        const batch = newUploads.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(uploadFile));
        results.push(
          ...batchResults.filter((r): r is UploadedFile => r !== null)
        );
      }

      // Notify parent of completed uploads
      if (results.length > 0) {
        onUploadComplete?.(results);
        toast.success(
          results.length === 1
            ? "Image uploaded"
            : `${results.length} images uploaded`
        );
      }

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status !== "complete"));
      }, 2000);
    },
    [
      folder,
      effectiveMaxSize,
      maxFiles,
      uploadFile,
      onUploadComplete,
      onUploadError,
      setUploads,
    ]
  );

  // Retry a failed upload
  const retryUpload = useCallback(
    async (uploadId: string) => {
      const upload = uploads.find((u) => u.id === uploadId);
      if (!upload || upload.status !== "error") return;

      // Reset the upload state
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                status: "pending" as const,
                error: undefined,
                progress: 0,
              }
            : u
        )
      );

      // Retry the upload
      const result = await uploadFile({
        ...upload,
        status: "pending",
        progress: 0,
      });
      if (result) {
        onUploadComplete?.([result]);
        toast.success("Image uploaded");
        // Clear after success
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 2000);
      }
    },
    [uploads, uploadFile, onUploadComplete]
  );

  // Dismiss a failed upload
  const dismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  // Clear all failed uploads
  const clearFailedUploads = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "error"));
  }, []);

  // Count failed uploads
  const failedCount = uploads.filter((u) => u.status === "error").length;

  // Drag handlers
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setIsDragOver(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setIsDragOver(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isUploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [disabled, isUploading, processFiles]
  );

  // File input handler
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input to allow selecting the same file again
      e.target.value = "";
    },
    [processFiles]
  );

  // Click to open file dialog
  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading]);

  // Render compact version
  if (compact) {
    return (
      <div className={cn("relative", className)}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={effectiveAccept}
          multiple={maxFiles > 1}
          onChange={handleFileChange}
          disabled={disabled || isUploading}
          className="sr-only"
          suppressHydrationWarning
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || isUploading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg",
            "text-sm text-muted-foreground hover:text-foreground hover:border-foreground/50",
            "transition-colors cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isDragOver && "border-primary bg-primary/5"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </div>
    );
  }

  // Render full dropzone
  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={effectiveAccept}
        multiple={maxFiles > 1}
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="sr-only"
        suppressHydrationWarning
      />

      <motion.div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragOver
            ? "hsl(var(--primary))"
            : "hsl(var(--border))",
          backgroundColor: isDragOver
            ? "hsl(var(--primary) / 0.05)"
            : "transparent",
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-6",
          "border-2 border-dashed rounded-lg cursor-pointer",
          "transition-colors",
          "hover:border-muted-foreground/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed",
          isUploading && "pointer-events-none"
        )}
      >
        {children ?? (
          <>
            <motion.div
              animate={{ scale: isDragOver ? 1.1 : 1 }}
              className={cn(
                "rounded-full p-3",
                isDragOver ? "bg-primary/10" : "bg-muted"
              )}
            >
              <Upload
                className={cn(
                  "size-6",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )}
              />
            </motion.div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragOver ? "Drop files here" : "Drag & drop images here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse • Max {formatFileSize(effectiveMaxSize)}
              </p>
            </div>
          </>
        )}
      </motion.div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2 overflow-hidden"
          >
            {/* Clear all failed button */}
            {failedCount > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-end"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFailedUploads}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3 mr-1" />
                  Clear {failedCount} failed
                </Button>
              </motion.div>
            )}

            {uploads.map((upload) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, x: -20 }}
                animate={
                  upload.status === "error"
                    ? {
                        opacity: 1,
                        x: [0, -8, 8, -8, 8, 0],
                        transition: { x: { duration: 0.4, ease: "easeInOut" } },
                      }
                    : { opacity: 1, x: 0 }
                }
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border bg-background",
                  upload.status === "error" &&
                    "border-destructive/50 bg-destructive/5",
                  upload.status === "complete" &&
                    "border-green-500/50 bg-green-50"
                )}
              >
                <div className="shrink-0">
                  {upload.status === "pending" && (
                    <FileImage className="size-5 text-muted-foreground" />
                  )}
                  {upload.status === "uploading" && (
                    <Loader2 className="size-5 text-primary animate-spin" />
                  )}
                  {upload.status === "complete" && (
                    <CheckCircle2 className="size-5 text-green-600" />
                  )}
                  {upload.status === "error" && (
                    <XCircle className="size-5 text-destructive" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {upload.file.name}
                  </p>
                  {upload.status === "uploading" && (
                    <Progress value={upload.progress} className="mt-1 h-1.5" />
                  )}
                  {upload.status === "error" && upload.error && (
                    <p className="text-xs text-destructive truncate">
                      {upload.error}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  {upload.status === "uploading" && (
                    <span className="text-xs text-muted-foreground">
                      {upload.progress}%
                    </span>
                  )}
                  {upload.status === "complete" && (
                    <span className="text-xs text-muted-foreground">Done</span>
                  )}
                  {upload.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      Waiting...
                    </span>
                  )}
                  {upload.status === "error" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:bg-primary/10"
                        onClick={() => retryUpload(upload.id)}
                        title="Retry upload"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => dismissUpload(upload.id)}
                        title="Dismiss"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
