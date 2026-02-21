import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ImageGalleryProps } from "@/lib/page-builder/types";

const gapMap = { none: "0px", sm: "8px", md: "16px", lg: "24px" };

const gridColumnClasses: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const masonryColumnClasses: Record<number, string> = {
  2: "[column-count:1] sm:[column-count:2]",
  3: "[column-count:1] sm:[column-count:2] lg:[column-count:3]",
  4: "[column-count:1] sm:[column-count:2] lg:[column-count:4]",
};

const aspectRatioMap = {
  square: "aspect-square",
  landscape: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "",
};

/** Resolve store-relative links: /products → basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

export function ImageGallerySection(
  props: ImageGalleryProps & { id: string; basePath?: string; puck?: unknown }
) {
  const {
    title,
    images = [],
    layout,
    columns,
    gap,
    aspectRatio,
    basePath = "",
  } = props;

  if (images.length === 0) {
    return (
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {title && (
            <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
          )}
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed py-12 text-muted-foreground">
            Add images to this gallery
          </div>
        </div>
      </section>
    );
  }

  const gapValue = gapMap[gap];

  const renderImage = (
    img: { url: string; alt: string; linkUrl?: string },
    index: number
  ) => {
    const aspectClass = aspectRatioMap[aspectRatio];

    const imageEl = (
      <div
        className={`relative overflow-hidden rounded-lg ${aspectClass}`}
        style={aspectRatio === "auto" ? undefined : undefined}
      >
        <Image
          src={img.url}
          alt={img.alt || `Gallery image ${index + 1}`}
          fill
          className="object-cover"
          sizes={`(max-width: 640px) 100vw, (max-width: 1024px) 50vw, ${Math.round(100 / columns)}vw`}
        />
      </div>
    );

    if (img.linkUrl) {
      return (
        <Link
          key={index}
          href={resolveLink(img.linkUrl, basePath)}
          className="block hover:opacity-90 transition-opacity"
        >
          {imageEl}
        </Link>
      );
    }

    return <div key={index}>{imageEl}</div>;
  };

  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
        )}

        {layout === "grid" && (
          <div
            className={cn(
              "grid",
              gridColumnClasses[columns] || gridColumnClasses[3]
            )}
            style={{ gap: gapValue }}
          >
            {images.map((img, i) => renderImage(img, i))}
          </div>
        )}

        {layout === "masonry" && (
          <div
            className={masonryColumnClasses[columns] || masonryColumnClasses[3]}
            style={{ columnGap: gapValue }}
          >
            {images.map((img, i) => (
              <div
                key={i}
                style={{
                  breakInside: "avoid",
                  marginBottom: gapValue,
                }}
              >
                {renderImage(img, i)}
              </div>
            ))}
          </div>
        )}

        {layout === "carousel" && (
          <div
            className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
            style={{ gap: gapValue }}
          >
            {images.map((img, i) => (
              <div
                key={i}
                className="shrink-0 snap-start"
                style={{
                  width: `${Math.round(100 / Math.min(columns, images.length))}%`,
                }}
              >
                {renderImage(img, i)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
