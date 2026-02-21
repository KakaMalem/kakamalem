"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { VideoHeroProps, CTAButton } from "@/lib/page-builder/types";

const heightClasses: Record<VideoHeroProps["height"], string> = {
  sm: "h-[300px]",
  md: "h-[400px] sm:h-[500px]",
  lg: "h-[500px] sm:h-[600px] lg:h-[700px]",
  full: "h-screen",
};

const headingSizeClasses: Record<VideoHeroProps["headingSize"], string> = {
  md: "text-2xl sm:text-3xl lg:text-4xl",
  lg: "text-3xl sm:text-4xl lg:text-5xl",
  xl: "text-4xl sm:text-5xl lg:text-6xl",
  "2xl": "text-5xl sm:text-6xl lg:text-7xl",
};

const textAlignClasses: Record<VideoHeroProps["textAlign"], string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const contentPositionClasses: Record<
  VideoHeroProps["contentPosition"],
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
  textColor: VideoHeroProps["textColor"]
): string {
  if (textColor === "dark") {
    switch (style) {
      case "primary":
        return "bg-black text-white hover:bg-black/85";
      case "secondary":
        return "bg-neutral-800 text-white hover:bg-neutral-700";
      case "outline":
        return "border-2 border-black text-black hover:bg-black hover:text-white";
    }
  }

  // light text (default for video overlays)
  switch (style) {
    case "primary":
      return "bg-white text-black hover:bg-white/90";
    case "secondary":
      return "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30";
    case "outline":
      return "border-2 border-white text-white hover:bg-white hover:text-black";
  }
}

/** Resolve store-relative links: /products -> basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

export function VideoHero({
  mediaType = "image",
  imageUrl = "",
  mobileImageUrl = "",
  videoUrl = "",
  mobileVideoUrl = "",
  videoPosterUrl = "",
  mobileVideoPosterUrl = "",
  autoplay = true,
  loop = true,
  muted = true,
  overlayOpacity = 30,
  overlayColor = "#000000",
  heading = "",
  subheading = "",
  headingSize = "xl",
  textAlign = "center",
  textColor = "light",
  overlayImageUrl = "",
  ctaButtons = [],
  height = "lg",
  contentPosition = "center",
  priority = false,
  basePath = "",
}: VideoHeroProps & { priority?: boolean; basePath?: string }) {
  const isLight = textColor === "light";

  // Parse overlay color to rgb for rgba usage
  const overlayRgba = (() => {
    if (!overlayColor) return `rgba(0,0,0,${overlayOpacity / 100})`;
    // Handle hex color
    if (overlayColor.startsWith("#")) {
      const hex = overlayColor.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r},${g},${b},${overlayOpacity / 100})`;
    }
    return `rgba(0,0,0,${overlayOpacity / 100})`;
  })();

  return (
    <section
      className={cn(
        "relative flex w-full overflow-hidden",
        heightClasses[height]
      )}
    >
      {/* ---- Background Media ---- */}
      {mediaType === "video" ? (
        <>
          {/* Mobile video */}
          {mobileVideoUrl && (
            <video
              className="absolute inset-0 h-full w-full object-cover sm:hidden"
              src={mobileVideoUrl}
              poster={mobileVideoPosterUrl || videoPosterUrl || undefined}
              autoPlay={autoplay}
              muted={muted}
              loop={loop}
              playsInline
              aria-hidden="true"
            />
          )}
          {/* Desktop video (also shown on mobile when no mobile source) */}
          {videoUrl && (
            <video
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                mobileVideoUrl ? "hidden sm:block" : ""
              )}
              src={videoUrl}
              poster={videoPosterUrl || undefined}
              autoPlay={autoplay}
              muted={muted}
              loop={loop}
              playsInline
              aria-hidden="true"
            />
          )}
        </>
      ) : (
        <>
          {/* Image fallback mode */}
          {mobileImageUrl && (
            <Image
              src={mobileImageUrl}
              alt={heading || "Hero image"}
              fill
              className="object-cover sm:hidden"
              priority={priority}
              sizes="100vw"
            />
          )}
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={heading || "Hero image"}
              fill
              className={cn(
                "object-cover",
                mobileImageUrl ? "hidden sm:block" : ""
              )}
              priority={priority}
              sizes="100vw"
            />
          )}
        </>
      )}

      {/* ---- Dark Overlay ---- */}
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: overlayRgba }}
          aria-hidden="true"
        />
      )}

      {/* ---- Content ---- */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20",
          contentPositionClasses[contentPosition],
          textAlignClasses[textAlign]
        )}
      >
        <div
          className={cn(
            "w-full max-w-4xl",
            contentPosition === "center" && "mx-auto",
            contentPosition === "bottom-center" && "mx-auto",
            contentPosition === "right" && "ml-auto"
          )}
        >
          {/* Overlay logo / badge */}
          {overlayImageUrl && (
            <div
              className={cn(
                "mb-4 sm:mb-6",
                textAlign === "center" && "flex justify-center",
                textAlign === "right" && "flex justify-end"
              )}
            >
              <Image
                src={overlayImageUrl}
                alt=""
                width={120}
                height={60}
                className="h-8 w-auto sm:h-10 lg:h-12"
              />
            </div>
          )}

          {/* Heading */}
          {heading && (
            <h2
              className={cn(
                "font-bold tracking-tight",
                headingSizeClasses[headingSize],
                isLight ? "text-white" : "text-black"
              )}
            >
              {heading}
            </h2>
          )}

          {/* Subheading */}
          {subheading && (
            <p
              className={cn(
                "mt-3 max-w-2xl text-base sm:mt-4 sm:text-lg lg:text-xl",
                isLight ? "text-white/90" : "text-neutral-700",
                textAlign === "center" && "mx-auto",
                textAlign === "right" && "ml-auto"
              )}
            >
              {subheading}
            </p>
          )}

          {/* CTA Buttons */}
          {ctaButtons.length > 0 && (
            <div
              className={cn(
                "mt-6 flex flex-wrap gap-3 sm:mt-8 sm:gap-4",
                textAlign === "center" && "justify-center",
                textAlign === "right" && "justify-end"
              )}
            >
              {ctaButtons.map((button, index) => (
                <Link
                  key={index}
                  href={resolveLink(button.href, basePath)}
                  className={cn(
                    buttonBaseClasses,
                    getButtonClasses(button.style, textColor)
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
