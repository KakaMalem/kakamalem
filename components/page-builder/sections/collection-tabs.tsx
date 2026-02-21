"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  CollectionTabsProps,
  CollectionTabCard,
} from "@/lib/page-builder/types";

const aspectRatioClasses: Record<CollectionTabCard["aspectRatio"], string> = {
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
};

const columnsClasses: Record<CollectionTabsProps["columns"], string> = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
};

const gapClasses: Record<CollectionTabsProps["gap"], string> = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

/** Resolve store-relative links: /products -> basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

export function CollectionTabs({
  heading = "",
  tabs = [],
  layout: _layout = "grid",
  columns = "4",
  cardStyle = "overlay",
  gap = "md",
  backgroundColor = "",
  basePath = "",
}: CollectionTabsProps & { basePath?: string }) {
  const [activeTab, setActiveTab] = useState(0);

  // Empty state for editor
  if (!tabs || tabs.length === 0) {
    return (
      <section
        className="flex min-h-[200px] items-center justify-center border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-12"
        style={backgroundColor ? { backgroundColor } : undefined}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Collection Tabs
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add tabs and cards in the settings panel
          </p>
        </div>
      </section>
    );
  }

  const currentTab = tabs[activeTab] ?? tabs[0];
  const cards = currentTab?.cards ?? [];

  return (
    <section
      className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        {heading && (
          <h2 className="text-2xl font-bold uppercase tracking-tight sm:text-3xl lg:text-4xl">
            {heading}
          </h2>
        )}

        {/* Tab buttons */}
        {tabs.length > 1 && (
          <div className="mt-4 flex gap-4 sm:mt-6 sm:gap-6">
            {tabs.map((tab, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveTab(index)}
                className={cn(
                  "relative pb-1.5 text-sm lowercase tracking-wide transition-colors",
                  activeTab === index
                    ? "text-foreground after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Cards grid */}
        <div
          className={cn(
            "mt-6 grid grid-cols-2 sm:mt-8",
            columnsClasses[columns],
            gapClasses[gap]
          )}
        >
          {cards.map((card, cardIndex) => (
            <CollectionCard
              key={`${activeTab}-${cardIndex}`}
              card={card}
              cardStyle={cardStyle}
              basePath={basePath}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CollectionCard({
  card,
  cardStyle,
  basePath,
}: {
  card: CollectionTabCard;
  cardStyle: CollectionTabsProps["cardStyle"];
  basePath: string;
}) {
  const aspectClass = aspectRatioClasses[card.aspectRatio] || "aspect-[4/5]";
  const href = resolveLink(card.href, basePath) || "#";

  return (
    <Link href={href} className="group block">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md",
          aspectClass
        )}
      >
        {/* Mobile image */}
        {card.mobileImageUrl && (
          <Image
            src={card.mobileImageUrl}
            alt={card.title || ""}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105 sm:hidden"
            sizes="(max-width: 640px) 50vw, 0vw"
          />
        )}
        {/* Desktop image (also fallback on mobile when no mobileImageUrl) */}
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.title || ""}
            fill
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              card.mobileImageUrl ? "hidden sm:block" : ""
            )}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">No image</span>
          </div>
        )}

        {/* Overlay text at bottom */}
        {cardStyle === "overlay" && (card.title || card.subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 sm:p-4">
            {card.title && (
              <p className="text-sm font-semibold text-white sm:text-base">
                {card.title}
              </p>
            )}
            {card.subtitle && (
              <p className="mt-0.5 text-xs text-white/80 sm:text-sm">
                {card.subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Text below image */}
      {cardStyle === "below" && (card.title || card.subtitle) && (
        <div className="mt-2 px-0.5">
          {card.title && (
            <p className="text-sm font-semibold text-foreground sm:text-base">
              {card.title}
            </p>
          )}
          {card.subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {card.subtitle}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
