"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X, SwitchCamera, Loader2, Flashlight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Hook to integrate dialog with browser history for back button support
function useDialogHistory(isOpen: boolean, onClose: () => void) {
  const historyPushedRef = useRef(false);

  const handlePopState = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      if (!historyPushedRef.current) {
        window.history.pushState(
          { barcodeScanner: true },
          "",
          window.location.href
        );
        historyPushedRef.current = true;
      }
    } else {
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);
}

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Supported barcode formats for retail
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScanner({
  onScan,
  onClose,
  open,
  onOpenChange,
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // Cleanup scanner on unmount or close
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchEnabled(false);
    setTorchSupported(false);
  }, []);

  // Start scanner with given camera
  const startScanner = useCallback(
    async (cameraId?: string) => {
      if (!containerRef.current) return;

      setError(null);
      setIsScanning(true);

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        setError("Camera requires HTTPS. Please use a secure connection.");
        setIsScanning(false);
        return;
      }

      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera is not supported on this browser.");
        setIsScanning(false);
        return;
      }

      try {
        // First, explicitly request camera permission - prefer back camera
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          });
          // IMPORTANT: Stop the stream immediately after permission check
          // Otherwise the camera stays locked and Html5Qrcode can't access it
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr) {
          if (permErr instanceof Error) {
            if (permErr.name === "NotAllowedError") {
              setError(
                "Camera access denied. Please allow camera permission in your browser settings."
              );
            } else if (permErr.name === "NotFoundError") {
              setError("No camera found on this device.");
            } else {
              setError(`Camera error: ${permErr.message}`);
            }
          } else {
            setError("Failed to access camera. Please check permissions.");
          }
          setIsScanning(false);
          return;
        }

        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices.length === 0) {
          setError("No camera found on this device");
          setIsScanning(false);
          return;
        }

        setCameras(devices);

        // Determine which camera to use
        let useFacingMode = !cameraId; // Use facingMode for initial start
        const selectedCameraId = cameraId;
        let selectedCameraIndex = 0;

        if (!cameraId) {
          // Find back camera by label for the index tracking
          const backCameraIndex = devices.findIndex(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("rear") ||
              d.label.toLowerCase().includes("environment")
          );
          selectedCameraIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
          setCurrentCameraIndex(selectedCameraIndex);
        } else {
          // When switching cameras, use camera ID
          useFacingMode = false;
          selectedCameraIndex = devices.findIndex((d) => d.id === cameraId);
        }

        // Initialize scanner
        scannerRef.current = new Html5Qrcode("barcode-scanner-container", {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });

        // Use facingMode for better back camera compatibility, or camera ID when switching
        const cameraConfig = useFacingMode
          ? { facingMode: "environment" }
          : selectedCameraId || devices[selectedCameraIndex].id;

        await scannerRef.current.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            // Prevent duplicate scans within 2 seconds
            if (lastScanned === decodedText) return;
            setLastScanned(decodedText);
            setTimeout(() => setLastScanned(null), 2000);

            // Vibrate on successful scan (if supported)
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }

            onScan(decodedText);

            // Auto-close after scan
            if (onOpenChange) {
              stopScanner();
              onOpenChange(false);
            }
          },
          () => {
            // QR code not detected - this is normal, ignore
          }
        );

        // Check torch support
        try {
          const capabilities =
            scannerRef.current.getRunningTrackCameraCapabilities();
          setTorchSupported(capabilities.torchFeature().isSupported());
        } catch {
          setTorchSupported(false);
        }

        // Fix for Xiaomi/MIUI black screen: ensure video element has proper attributes
        // The html5-qrcode library creates a video element that may not have all
        // necessary attributes for proper rendering on some Android devices
        setTimeout(() => {
          const container = document.getElementById(
            "barcode-scanner-container"
          );
          const videoElement = container?.querySelector("video");
          if (videoElement) {
            // Required for inline playback on iOS and some Android devices
            videoElement.setAttribute("playsinline", "true");
            videoElement.setAttribute("webkit-playsinline", "true");
            // Prevent controls from showing
            videoElement.setAttribute("disablepictureinpicture", "true");
            // Force a repaint on problematic devices
            videoElement.style.display = "none";
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            videoElement.offsetHeight; // Trigger reflow
            videoElement.style.display = "block";
          }
        }, 100);
      } catch (e) {
        console.error("Scanner error:", e);
        setError(
          e instanceof Error
            ? e.message
            : "Failed to start camera. Please check permissions."
        );
        setIsScanning(false);
      }
    },
    [onScan, onOpenChange, stopScanner, lastScanned]
  );

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    await stopScanner();
    await startScanner(cameras[nextIndex].id);
  }, [cameras, currentCameraIndex, stopScanner, startScanner]);

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !torchSupported) return;

    try {
      const capabilities =
        scannerRef.current.getRunningTrackCameraCapabilities();
      const torchFeature = capabilities.torchFeature();
      await torchFeature.apply(!torchEnabled);
      setTorchEnabled(!torchEnabled);
    } catch (e) {
      console.error("Torch error:", e);
    }
  }, [torchEnabled, torchSupported]);

  // Start/stop scanner when dialog opens/closes
  useEffect(() => {
    // Use a local flag to avoid calling startScanner synchronously
    let mounted = true;
    let timeoutId: NodeJS.Timeout | undefined;

    if (open) {
      // Defer the scanner start to avoid synchronous setState in effect
      timeoutId = setTimeout(() => {
        if (mounted) {
          startScanner();
        }
      }, 0);
    } else {
      // Defer stopScanner as well to avoid synchronous setState
      timeoutId = setTimeout(() => {
        if (mounted) {
          stopScanner();
        }
      }, 0);
    }

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose?.();
    onOpenChange?.(false);
  }, [stopScanner, onClose, onOpenChange]);

  // Integrate with browser history for back button support (mobile UX)
  useDialogHistory(open ?? false, handleClose);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black">
          {/* Scanner container */}
          <div
            id="barcode-scanner-container"
            ref={containerRef}
            className="w-full aspect-16/10"
          />

          {/* Scanning overlay */}
          {isScanning && !error && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Scan line animation */}
              <div className="absolute inset-x-[15%] top-[35%] bottom-[35%] border-2 border-primary rounded-lg">
                <div className="absolute inset-x-0 h-0.5 bg-primary animate-scan" />
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
                Point camera at barcode
              </p>
            </div>
          )}

          {/* Loading state */}
          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center text-white">
                <Loader2 className="size-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
              <div className="text-center text-white">
                <Camera className="size-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-red-300 mb-4">{error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => startScanner()}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Controls */}
          {isScanning && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              {cameras.length > 1 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur"
                  onClick={switchCamera}
                >
                  <SwitchCamera className="size-5 text-white" />
                </Button>
              )}
              {torchSupported && (
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    "size-12 rounded-full backdrop-blur",
                    torchEnabled
                      ? "bg-yellow-500 hover:bg-yellow-600"
                      : "bg-white/20 hover:bg-white/30"
                  )}
                  onClick={toggleTorch}
                >
                  <Flashlight
                    className={cn(
                      "size-5",
                      torchEnabled ? "text-white" : "text-white"
                    )}
                  />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="p-4 pt-2">
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleClose}
          >
            <X className="mr-2 size-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>

      <style jsx global>{`
        @keyframes scan {
          0%,
          100% {
            top: 0;
          }
          50% {
            top: calc(100% - 2px);
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }

        /* Fix for Xiaomi/MIUI black screen issue */
        #barcode-scanner-container {
          /* Force GPU rendering */
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          will-change: transform;
        }

        #barcode-scanner-container video {
          /* Force video to be visible on problematic devices */
          opacity: 1 !important;
          visibility: visible !important;
          -webkit-transform: translateZ(0) !important;
          transform: translateZ(0) !important;
          /* Proper sizing */
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          /* Force hardware acceleration */
          -webkit-backface-visibility: hidden !important;
          backface-visibility: hidden !important;
          /* Ensure it's not hidden by parent */
          position: relative !important;
          z-index: 1 !important;
        }

        /* Ensure canvas overlay doesn't block video on some devices */
        #barcode-scanner-container canvas {
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
        }
      `}</style>
    </Dialog>
  );
}

// Standalone button to trigger scanner
interface BarcodeScannerButtonProps {
  onScan: (barcode: string) => void;
  className?: string;
  disabled?: boolean;
}

export function BarcodeScannerButton({
  onScan,
  className,
  disabled,
}: BarcodeScannerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("size-12", className)}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Camera className="size-5" />
      </Button>
      <BarcodeScanner open={open} onOpenChange={setOpen} onScan={onScan} />
    </>
  );
}
