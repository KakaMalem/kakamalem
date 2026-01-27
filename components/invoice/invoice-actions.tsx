"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

interface InvoiceActionsProps {
  token: string;
  orderNumber: string;
}

export function InvoiceActions({ token }: InvoiceActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Top Action Buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button asChild size="sm">
          <a href={`/invoice/${token}/download`} download>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </Button>
      </div>
    </>
  );
}

export function InvoiceShareActions({ orderNumber }: { orderNumber: string }) {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Invoice #${orderNumber}: ${window.location.href}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-500 print:hidden">
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1 hover:text-gray-900"
      >
        <Share2 className="h-4 w-4" />
        Copy Link
      </button>
      <span>|</span>
      <button onClick={handleWhatsAppShare} className="hover:text-green-600">
        Share on WhatsApp
      </button>
    </div>
  );
}
