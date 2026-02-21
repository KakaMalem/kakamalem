"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import type { ContentCardsProps, ContentCard } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

const gapMap: Record<string, string> = {
  none: "gap-0",
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-4",
};

const gapCarouselMap: Record<string, string> = {
  none: "pl-0",
  sm: "pl-1",
  md: "pl-2",
  lg: "pl-4",
};

const gapCarouselContentMap: Record<string, string> = {
  none: "-ml-0",
  sm: "-ml-1",
  md: "-ml-2",
  lg: "-ml-4",
};

const gridColumnClasses: Record<string, string> = {
  "2": "grid-cols-2",
  "3": "grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-2 lg:grid-cols-4",
};

const carouselBasisClasses: Record<string, string> = {
  "2": "basis-[80%] md:basis-1/2",
  "3": "basis-[80%] md:basis-1/2 lg:basis-1/3",
  "4": "basis-[80%] md:basis-1/3 lg:basis-1/4",
};

const aspectRatioMap: Record<string, string> = {
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
  "16/9": "aspect-[16/9]",
};

// ---------------------------------------------------------------------------
// Individual Card Renderers
// ---------------------------------------------------------------------------

interface CardRenderProps {
  card: ContentCard;
  cardStyle: ContentCardsProps["cardStyle"];
  overlayGradient: boolean;
}

function OverlayBottomCard({ card, overlayGradient }: CardRenderProps) {
  return (
    <Link
      href={card.href || "#"}
      className="group relative block overflow-hidden rounded-lg"
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectRatioMap[card.aspectRatio] || "aspect-[3/4]"
        )}
      >
        {card.imageUrl ? (
          <>
            {/* Desktop image */}
            <Image
              src={card.imageUrl}
              alt={card.title || ""}
              fill
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-105",
                card.mobileImageUrl && "hidden md:block"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {/* Mobile image */}
            {card.mobileImageUrl && (
              <Image
                src={card.mobileImageUrl}
                alt={card.title || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105 md:hidden"
                sizes="50vw"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {/* Gradient overlay */}
        {overlayGradient && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        )}

        {/* Text content at bottom */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          {card.title && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
              {card.title}
            </h3>
          )}
          {card.subtitle && (
            <p className="mt-0.5 text-[10px] text-white/80 line-clamp-2 sm:text-xs">
              {card.subtitle}
            </p>
          )}
          {card.ctaText && (
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white underline underline-offset-4 transition-all group-hover:gap-2 sm:text-xs">
              {card.ctaText}
              <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function OverlayCenterCard({ card, overlayGradient }: CardRenderProps) {
  return (
    <Link
      href={card.href || "#"}
      className="group relative block overflow-hidden rounded-lg"
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectRatioMap[card.aspectRatio] || "aspect-[3/4]"
        )}
      >
        {card.imageUrl ? (
          <>
            <Image
              src={card.imageUrl}
              alt={card.title || ""}
              fill
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-105",
                card.mobileImageUrl && "hidden md:block"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {card.mobileImageUrl && (
              <Image
                src={card.mobileImageUrl}
                alt={card.title || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105 md:hidden"
                sizes="50vw"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}

        {/* Overlay */}
        {overlayGradient && (
          <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />
        )}

        {/* Centered text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          {card.title && (
            <h3 className="text-sm font-bold uppercase tracking-wider text-white sm:text-base lg:text-lg">
              {card.title}
            </h3>
          )}
          {card.subtitle && (
            <p className="mt-1 text-xs text-white/80 line-clamp-2 sm:text-sm">
              {card.subtitle}
            </p>
          )}
          {card.ctaText && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-colors group-hover:bg-white group-hover:text-black sm:text-xs">
              {card.ctaText}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BelowCard({ card }: CardRenderProps) {
  return (
    <Link href={card.href || "#"} className="group block overflow-hidden">
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-muted",
          aspectRatioMap[card.aspectRatio] || "aspect-[3/4]"
        )}
      >
        {card.imageUrl ? (
          <>
            <Image
              src={card.imageUrl}
              alt={card.title || ""}
              fill
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-105",
                card.mobileImageUrl && "hidden md:block"
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {card.mobileImageUrl && (
              <Image
                src={card.mobileImageUrl}
                alt={card.title || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105 md:hidden"
                sizes="50vw"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </div>

      {/* Text below image */}
      <div className="mt-3">
        {card.title && (
          <h3 className="text-xs font-bold uppercase tracking-wider sm:text-sm">
            {card.title}
          </h3>
        )}
        {card.subtitle && (
          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 sm:text-xs">
            {card.subtitle}
          </p>
        )}
        {card.ctaText && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider underline underline-offset-4 transition-all group-hover:gap-2 sm:text-xs">
            {card.ctaText}
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  );
}

const cardStyleComponents = {
  "overlay-bottom": OverlayBottomCard,
  "overlay-center": OverlayCenterCard,
  below: BelowCard,
} as const;

// ---------------------------------------------------------------------------
// ContentCards Section
// ---------------------------------------------------------------------------

export function ContentCardsSection(
  props: ContentCardsProps & { id?: string; puck?: unknown }
) {
  const {
    heading = "",
    cards = [],
    layout = "grid",
    columns = "3",
    gap = "md",
    cardStyle = "overlay-bottom",
    overlayGradient = true,
    backgroundColor = "",
  } = props;

  const CardComponent = cardStyleComponents[cardStyle] || OverlayBottomCard;

  // Empty state — editor placeholder
  if (!cards || cards.length === 0) {
    return (
        <section
          className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8"
          style={backgroundColor ? { backgroundColor } : undefined}
        >
          <div className="mx-auto max-w-7xl">
            {heading && (
              <h2 className="mb-6 text-xl font-bold sm:text-2xl lg:text-3xl">
                {heading}
              </h2>
            )}
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-12">
              <ImageIcon className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Content Cards
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Add cards to display content here
              </p>
            </div>
          </div>
        </section>
      );
    }
  }

  return (
    <section
      className="py-8 px-4 sm:px-6 sm:py-12 lg:px-8"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        {heading && (
          <h2 className="mb-6 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
            {heading}
          </h2>
        )}

        {/* Grid layout */}
        {layout === "grid" && (
          <div
            className={cn(
              "grid",
              gapMap[gap] || gapMap.md,
              gridColumnClasses[columns] || gridColumnClasses["3"]
            )}
          >
            {cards.map((card, index) => (
              <CardComponent
                key={index}
                card={card}
                cardStyle={cardStyle}
                overlayGradient={overlayGradient}
              />
            ))}
          </div>
        )}

        {/* Carousel layout */}
        {layout === "carousel" && (
          <Carousel opts={{ align: "start", loop: false }} className="w-full">
            <CarouselContent
              className={cn(
                gapCarouselContentMap[gap] || gapCarouselContentMap.md
              )}
            >
              {cards.map((card, index) => (
                <CarouselItem
                  key={index}
                  className={cn(
                    gapCarouselMap[gap] || gapCarouselMap.md,
                    carouselBasisClasses[columns] || carouselBasisClasses["3"]
                  )}
                >
                  <CardComponent
                    card={card}
                    cardStyle={cardStyle}
                    overlayGradient={overlayGradient}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            {cards.length > parseInt(columns) && (
              <>
                <CarouselPrevious className="hidden sm:inline-flex left-0 -translate-x-1/2 border-0 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background" />
                <CarouselNext className="hidden sm:inline-flex right-0 translate-x-1/2 border-0 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background" />
              </>
            )}
          </Carousel>
        )}
      </div>
    </section>
  );
}
