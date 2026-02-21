import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroBannerProps, CTAButton } from "@/lib/page-builder/types";

const heightClasses: Record<HeroBannerProps["minHeight"], string> = {
  small: "min-h-[300px]",
  medium: "min-h-[400px] sm:min-h-[500px]",
  large: "min-h-[500px] sm:min-h-[600px]",
  full: "min-h-[calc(100vh-200px)]",
};

const headingSizeClasses: Record<
  NonNullable<HeroBannerProps["headingSize"]>,
  string
> = {
  md: "text-2xl sm:text-3xl lg:text-4xl",
  lg: "text-3xl sm:text-4xl lg:text-5xl",
  xl: "text-3xl sm:text-4xl lg:text-5xl xl:text-6xl",
  "2xl": "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
};

const alignClasses: Record<HeroBannerProps["textAlignment"], string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const contentPositionClasses: Record<
  NonNullable<HeroBannerProps["contentPosition"]>,
  string
> = {
  left: "items-start justify-center",
  center: "items-center justify-center",
  right: "items-end justify-center",
  "bottom-left": "items-start justify-end",
  "bottom-center": "items-center justify-end",
};

const buttonBaseClasses =
  "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold transition-colors sm:px-7 sm:py-3 sm:text-base";

function getButtonClasses(
  style: CTAButton["style"],
  hasImage: boolean
): string {
  if (hasImage) {
    switch (style) {
      case "primary":
        return "bg-white text-black hover:bg-white/90";
      case "secondary":
        return "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30";
      case "outline":
        return "border-2 border-white text-white hover:bg-white hover:text-black";
    }
  }
  switch (style) {
    case "primary":
      return "bg-primary text-primary-foreground hover:bg-primary/90";
    case "secondary":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "outline":
      return "border-2 border-foreground text-foreground hover:bg-foreground hover:text-background";
  }
}

/** Resolve store-relative links: /products → basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

export function HeroBanner({
  imageUrl = "",
  mobileImageUrl = "",
  imageAlt = "",
  title = "",
  subtitle = "",
  headingSize = "xl",
  ctaText = "",
  ctaLink = "",
  ctaButtons = [],
  overlayOpacity = 40,
  textAlignment = "center",
  contentPosition = "center",
  minHeight = "medium",
  priority = false,
  basePath = "",
}: HeroBannerProps & { priority?: boolean; basePath?: string }) {
  const hasImage = imageUrl && imageUrl.length > 0;

  // Backward compat: merge legacy single CTA into ctaButtons if ctaButtons is empty
  const resolvedButtons: CTAButton[] =
    ctaButtons && ctaButtons.length > 0
      ? ctaButtons
      : ctaText && ctaLink
        ? [{ text: ctaText, href: ctaLink, style: "primary" as const }]
        : [];

  return (
    <section
      className={cn(
        "relative flex w-full overflow-hidden",
        heightClasses[minHeight],
        !hasImage && "bg-muted"
      )}
    >
      {/* Background Image — Desktop */}
      {hasImage && (
        <Image
          src={imageUrl}
          alt={imageAlt || title || "Hero banner"}
          fill
          className={cn(
            "object-cover",
            mobileImageUrl ? "hidden sm:block" : ""
          )}
          priority={priority}
          sizes="100vw"
        />
      )}

      {/* Background Image — Mobile */}
      {mobileImageUrl && (
        <Image
          src={mobileImageUrl}
          alt={imageAlt || title || "Hero banner"}
          fill
          className="object-cover sm:hidden"
          priority={priority}
          sizes="100vw"
        />
      )}

      {/* Overlay */}
      {hasImage && overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}

      {/* Content */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20",
          contentPositionClasses[contentPosition || "center"],
          alignClasses[textAlignment]
        )}
      >
        <div
          className={cn(
            "w-full max-w-4xl",
            (contentPosition === "center" ||
              contentPosition === "bottom-center") &&
              "mx-auto",
            contentPosition === "right" && "ml-auto"
          )}
        >
          {title && (
            <h1
              className={cn(
                "font-bold tracking-tight",
                headingSizeClasses[headingSize || "xl"],
                hasImage ? "text-white" : "text-foreground"
              )}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className={cn(
                "mt-4 text-base sm:text-lg lg:text-xl max-w-2xl",
                hasImage ? "text-white/90" : "text-muted-foreground",
                textAlignment === "center" && "mx-auto"
              )}
            >
              {subtitle}
            </p>
          )}
          {resolvedButtons.length > 0 && (
            <div
              className={cn(
                "mt-6 flex flex-wrap gap-3 sm:mt-8 sm:gap-4",
                textAlignment === "center" && "justify-center",
                textAlignment === "right" && "justify-end"
              )}
            >
              {resolvedButtons.map((button, index) => (
                <Link
                  key={index}
                  href={resolveLink(button.href, basePath)}
                  className={cn(
                    buttonBaseClasses,
                    getButtonClasses(button.style, !!hasImage)
                  )}
                >
                  {button.text}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
