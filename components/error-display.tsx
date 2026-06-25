"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldX,
  ServerCrash,
  RefreshCw,
  Home,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { classifyError, generateErrorReference, logError } from "@/lib/errors";
import type { ErrorCategory } from "@/lib/errors";
import { isDeploymentSkewError, reloadForUpdate } from "@/lib/app-reload";

interface ErrorDisplayProps {
  error: Error & { digest?: string };
  reset?: () => void;
  backUrl?: string;
  backLabel?: string;
  homeUrl?: string;
  homeLabel?: string;
  fullScreen?: boolean;
}

const categoryIcons: Record<ErrorCategory, React.ReactNode> = {
  system: <ServerCrash className="h-8 w-8" />,
  database: <WifiOff className="h-8 w-8" />,
  authentication: <ShieldX className="h-8 w-8" />,
  authorization: <ShieldX className="h-8 w-8" />,
  validation: <AlertTriangle className="h-8 w-8" />,
  not_found: <AlertTriangle className="h-8 w-8" />,
  external_service: <WifiOff className="h-8 w-8" />,
  rate_limit: <Clock className="h-8 w-8" />,
  maintenance: <ServerCrash className="h-8 w-8" />,
};

const categoryColors: Record<ErrorCategory, string> = {
  system: "bg-destructive/10 text-destructive",
  database: "bg-orange-500/10 text-orange-600",
  authentication: "bg-yellow-500/10 text-yellow-600",
  authorization: "bg-yellow-500/10 text-yellow-600",
  validation: "bg-blue-500/10 text-blue-600",
  not_found: "bg-muted text-muted-foreground",
  external_service: "bg-orange-500/10 text-orange-600",
  rate_limit: "bg-purple-500/10 text-purple-600",
  maintenance: "bg-blue-500/10 text-blue-600",
};

export function ErrorDisplay({
  error,
  reset,
  backUrl,
  backLabel = "Go Back",
  homeUrl = "/",
  homeLabel = "Go to Homepage",
  fullScreen = true,
}: ErrorDisplayProps) {
  const [errorRef] = useState(() => generateErrorReference());
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Append ?debug=1 to the URL to reveal the raw error on the page itself —
  // useful for diagnosing browser-specific (e.g. Safari) crashes without dev
  // tools. Off by default so normal users never see internals.
  const [showDebug] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  });

  // A stale build hitting a redeployed server: don't show a scary error,
  // just reload onto the fresh build. If the reload is suppressed (already
  // tried recently — i.e. it isn't really skew), fall through to the normal
  // error UI rather than spinning forever.
  const isSkew = isDeploymentSkewError(error);
  const [updating, setUpdating] = useState(isSkew);

  const classifiedError = classifyError(error);

  useEffect(() => {
    // Log error with reference
    logError(error, { errorRef });
  }, [error, errorRef]);

  useEffect(() => {
    if (!isSkew) return;
    reloadForUpdate().then((didReload) => {
      if (!didReload) setUpdating(false);
    });
  }, [isSkew]);

  if (updating) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }

  const handleRetry = async () => {
    if (!reset) return;
    setIsRetrying(true);
    // Small delay to show loading state
    await new Promise((resolve) => setTimeout(resolve, 500));
    reset();
  };

  const copyReference = async () => {
    await navigator.clipboard.writeText(errorRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerClasses = fullScreen
    ? "flex min-h-screen flex-col items-center justify-center px-6"
    : "flex min-h-[60vh] flex-col items-center justify-center px-6";

  const cardClasses = fullScreen
    ? "w-full max-w-md"
    : "w-full max-w-md border-0 shadow-none bg-transparent";

  return (
    <div className={containerClasses}>
      <Card className={cardClasses}>
        <CardContent className="pt-6 space-y-6">
          {/* Icon */}
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${categoryColors[classifiedError.category]}`}
          >
            {categoryIcons[classifiedError.category]}
          </div>

          {/* Message */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">
              {classifiedError.category === "maintenance"
                ? "Under Maintenance"
                : classifiedError.category === "database" ||
                    classifiedError.category === "external_service"
                  ? "Connection Issue"
                  : classifiedError.category === "rate_limit"
                    ? "Slow Down"
                    : classifiedError.category === "authentication"
                      ? "Session Expired"
                      : classifiedError.category === "authorization"
                        ? "Access Denied"
                        : "Something went wrong"}
            </h1>
            <p className="text-muted-foreground">{classifiedError.message}</p>
          </div>

          {/* Error Reference */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Reference:</span>
            <code className="font-mono text-foreground">{errorRef}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyReference}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Help text */}
          <p className="text-center text-xs text-muted-foreground">
            If this problem persists, please contact support with the reference
            code above.
          </p>

          {/* Raw diagnostics (only with ?debug=1) */}
          {showDebug && (
            <div className="rounded-lg border bg-muted/40 p-3 text-left">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Diagnostic details
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word text-[11px] leading-relaxed text-foreground/80">
                {error.name}: {error.message}
                {error.digest ? `\n\ndigest: ${error.digest}` : ""}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {classifiedError.retryable && reset && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
            )}

            {backUrl && (
              <Button
                variant={classifiedError.retryable ? "outline" : "default"}
                asChild
                className="w-full"
              >
                <Link href={backUrl}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {backLabel}
                </Link>
              </Button>
            )}

            <Button variant="ghost" asChild className="w-full">
              <Link href={homeUrl}>
                <Home className="mr-2 h-4 w-4" />
                {homeLabel}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
