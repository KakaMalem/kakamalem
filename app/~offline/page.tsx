"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <WifiOff className="size-12 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">You are offline</h1>
        <p className="text-muted-foreground mb-6">
          This page is not available offline. Please check your internet
          connection and try again.
        </p>
        <Button onClick={handleRetry} className="gap-2">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}
