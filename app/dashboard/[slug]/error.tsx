"use client";

import { ErrorDisplay } from "@/components/error-display";

export default function DashboardStoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDisplay
      error={error}
      reset={reset}
      backUrl="/dashboard"
      backLabel="Back to Dashboard"
      fullScreen={false}
    />
  );
}
