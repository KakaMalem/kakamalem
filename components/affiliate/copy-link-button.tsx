"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CopyLinkButtonProps {
  link: string;
}

export function CopyLinkButton({ link }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button onClick={handleCopy} className="shrink-0">
      {copied ? (
        <>
          <Check className="mr-2 size-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="mr-2 size-4" />
          Copy Link
        </>
      )}
    </Button>
  );
}
