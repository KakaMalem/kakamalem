"use client";

import { useCallback } from "react";
import { Printer, Unplug, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getThermalPrinter,
  ThermalPrinterService,
} from "@/lib/services/thermal-printer";
import {
  usePrinterStore,
  usePrinterStatus,
  useIsPrinterConnected,
} from "@/lib/stores/use-printer-store";
import { toast } from "sonner";

interface PrinterConnectionButtonProps {
  className?: string;
}

export function PrinterConnectionButton({
  className,
}: PrinterConnectionButtonProps) {
  const status = usePrinterStatus();
  const isConnected = useIsPrinterConnected();
  const { setStatus, setError } = usePrinterStore();

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    try {
      const printer = getThermalPrinter();
      const success = await printer.connect();

      if (success) {
        setStatus("connected");
        toast.success("Printer connected", {
          description: "Receipts will print automatically after checkout",
          action: {
            label: "Test Print",
            onClick: async () => {
              try {
                await printer.printTest();
                toast.success("Test print sent");
              } catch {
                toast.error("Test print failed");
              }
            },
          },
        });
      } else {
        // User cancelled
        setStatus("disconnected");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      setError(message);
      toast.error("Printer connection failed", {
        description: message,
      });
    }
  }, [setStatus, setError]);

  const handleDisconnect = useCallback(async () => {
    try {
      const printer = getThermalPrinter();
      await printer.disconnect();
      setStatus("disconnected");
      toast.success("Printer disconnected");
    } catch {
      // Ignore disconnect errors
      setStatus("disconnected");
    }
  }, [setStatus]);

  // Check if Web Serial is supported
  if (!ThermalPrinterService.isSupported()) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn("size-10 opacity-50", className)}
            disabled
          >
            <Printer className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Direct printing requires Chrome or Edge browser</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isConnected ? "default" : "outline"}
          size="icon"
          className={cn(
            "size-10 transition-colors",
            isConnected && "bg-green-600 hover:bg-green-700 text-white",
            status === "error" && "border-red-500 text-red-500",
            className
          )}
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : status === "error" ? (
            <AlertCircle className="size-5" />
          ) : isConnected ? (
            <Unplug className="size-5" />
          ) : (
            <Printer className="size-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {status === "connecting"
            ? "Connecting to printer..."
            : status === "error"
              ? "Connection failed - click to retry"
              : isConnected
                ? "Disconnect thermal printer"
                : "Connect thermal printer"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
