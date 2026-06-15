"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LinkQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  code: string;
}

export function LinkQrDialog({
  open,
  onOpenChange,
  url,
  code,
}: LinkQrDialogProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!open || !url) return;
    let active = true;
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((d) => {
        if (active) setDataUrl(d);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [open, url]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${code}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription className="break-all">{url}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border bg-white p-4">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={`QR code for ${code}`}
                width={224}
                height={224}
                className="size-56"
              />
            ) : (
              <div className="size-56 animate-pulse rounded bg-muted" />
            )}
          </div>
          <Button
            onClick={handleDownload}
            disabled={!dataUrl}
            className="w-full"
          >
            <Download className="mr-2 size-4" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
