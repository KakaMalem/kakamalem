"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AffiliateLinkCopyProps {
  url: string;
}

export function AffiliateLinkCopy({ url }: AffiliateLinkCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={url}
        readOnly
        className="font-mono text-sm"
        onClick={(e) => e.currentTarget.select()}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <Check className="size-4 text-green-600" />
        ) : (
          <Copy className="size-4" />
        )}
      </Button>
      <Button variant="outline" size="icon" asChild className="shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </div>
  );
}
