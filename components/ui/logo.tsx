import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /**
   * URL of the logo image
   */
  logoUrl: string | null | undefined;

  /**
   * Alt text for the logo (usually store name)
   */
  alt: string;

  /**
   * Size variant for the logo
   * - sm: 24px (h-6)
   * - md: 32px (h-8) - default
   * - lg: 36px (h-9)
   * - xl: 48px (h-12)
   */
  size?: "sm" | "md" | "lg" | "xl";

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Priority loading for above-the-fold images
   */
  priority?: boolean;

  /**
   * Fallback component to render when no logo is provided
   */
  fallback?: React.ReactNode;
}

const sizeMap = {
  sm: {
    height: 24,
    className: "h-6",
  },
  md: {
    height: 32,
    className: "h-8",
  },
  lg: {
    height: 36,
    className: "h-9",
  },
  xl: {
    height: 48,
    className: "h-12",
  },
} as const;

/**
 * Logo component that handles various aspect ratios intelligently.
 *
 * The logo maintains its aspect ratio while constraining the height.
 * - For wide logos (like 4:1 ratio): width expands naturally
 * - For square logos (1:1 ratio): maintains square shape
 * - For tall logos: height is constrained, width adjusts
 *
 * Uses Next.js Image component for optimization.
 */
export function Logo({
  logoUrl,
  alt,
  size = "md",
  className,
  priority = false,
  fallback,
}: LogoProps) {
  // If no logo URL, render fallback
  if (!logoUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  const { height, className: heightClass } = sizeMap[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center overflow-hidden",
        heightClass,
        className
      )}
      style={{
        // Width will be determined by the image's aspect ratio
        // The container adapts to the image content
        maxWidth: "100%",
      }}
    >
      <Image
        src={logoUrl}
        alt={alt}
        height={height}
        width={height * 4} // Start with a wide assumption (4:1), Image component will adjust
        className={cn("object-contain object-left", heightClass)}
        sizes={`${height * 4}px`}
        priority={priority}
        style={{
          width: "auto",
          height: "100%",
        }}
      />
    </div>
  );
}
