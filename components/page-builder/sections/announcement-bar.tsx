"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Megaphone, Tag, Sparkles, Truck } from "lucide-react";
import type { AnnouncementBarProps } from "@/lib/page-builder/types";

const iconMap = {
  none: null,
  megaphone: Megaphone,
  tag: Tag,
  sparkles: Sparkles,
  truck: Truck,
};

/** Resolve store-relative links: /products → basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

export function AnnouncementBar(
  props: AnnouncementBarProps & {
    id: string;
    basePath?: string;
    puck?: unknown;
  }
) {
  const {
    text,
    linkText,
    linkUrl,
    backgroundColor,
    textColor,
    dismissible,
    icon,
    basePath = "",
  } = props;

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`announcement-${props.id}`) === "dismissed";
  });

  if (dismissed) return null;

  const IconComponent = iconMap[icon];

  const handleDismiss = () => {
    localStorage.setItem(`announcement-${props.id}`, "dismissed");
    setDismissed(true);
  };

  return (
    <div
      className="relative w-full"
      style={{
        backgroundColor: backgroundColor || "#000",
        color: textColor || "#fff",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-center sm:px-6">
        {IconComponent && (
          <IconComponent className="hidden size-4 shrink-0 sm:block" />
        )}
        <p className="text-sm font-medium">
          {text}
          {linkText && linkUrl && (
            <>
              {" "}
              <Link
                href={resolveLink(linkUrl, basePath)}
                className="underline underline-offset-2 hover:opacity-80"
              >
                {linkText}
              </Link>
            </>
          )}
        </p>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 hover:opacity-70 sm:right-4"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Static RSC version for the storefront renderer (no dismiss functionality).
 * The storefront will wrap this with a client dismiss wrapper.
 */
export function AnnouncementBarStatic(
  props: AnnouncementBarProps & { id: string; basePath?: string }
) {
  const {
    text,
    linkText,
    linkUrl,
    backgroundColor,
    textColor,
    icon,
    basePath = "",
  } = props;

  const IconComponent = iconMap[icon];

  return (
    <div
      className="relative w-full"
      style={{
        backgroundColor: backgroundColor || "#000",
        color: textColor || "#fff",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-center sm:px-6">
        {IconComponent && (
          <IconComponent className="hidden size-4 shrink-0 sm:block" />
        )}
        <p className="text-sm font-medium">
          {text}
          {linkText && linkUrl && (
            <>
              {" "}
              <a
                href={resolveLink(linkUrl, basePath)}
                className="underline underline-offset-2 hover:opacity-80"
              >
                {linkText}
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
