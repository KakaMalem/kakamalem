import {
  Truck,
  RefreshCw,
  Clock,
  Shield,
  Star,
  Gift,
  Tag,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarqueeBarProps, MarqueeItem } from "@/lib/page-builder/types";

const iconMap = {
  truck: Truck,
  refresh: RefreshCw,
  clock: Clock,
  shield: Shield,
  star: Star,
  gift: Gift,
  tag: Tag,
  heart: Heart,
  none: null,
} as const;

const separatorMap: Record<MarqueeBarProps["separator"], string> = {
  dot: "\u2022",
  pipe: "|",
  star: "\u2605",
  none: "",
};

const speedDuration: Record<MarqueeBarProps["speed"], number> = {
  slow: 60,
  normal: 30,
  fast: 15,
};

const fontSizeClasses: Record<MarqueeBarProps["fontSize"], string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
};

/** Resolve store-relative links: /products -> basePath/products */
function resolveLink(link: string, basePath: string): string {
  if (!link || !basePath) return link;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return `${basePath}${link}`;
  }
  return link;
}

function MarqueeItemContent({
  item,
  fontSize,
  basePath,
}: {
  item: MarqueeItem;
  fontSize: MarqueeBarProps["fontSize"];
  basePath: string;
}) {
  const IconComponent = iconMap[item.icon];

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        fontSizeClasses[fontSize]
      )}
    >
      {IconComponent && <IconComponent className="size-3.5 shrink-0" />}
      <span className="font-medium">{item.text}</span>
    </span>
  );

  if (item.href) {
    return (
      <a
        href={resolveLink(item.href, basePath)}
        className="inline-flex items-center hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return content;
}

function MarqueeTrack({
  items,
  separator,
  fontSize,
  basePath,
}: {
  items: MarqueeItem[];
  separator: MarqueeBarProps["separator"];
  fontSize: MarqueeBarProps["fontSize"];
  basePath: string;
}) {
  const sep = separatorMap[separator];

  return (
    <>
      {items.map((item, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-x-6 sm:gap-x-8"
        >
          <MarqueeItemContent
            item={item}
            fontSize={fontSize}
            basePath={basePath}
          />
          {sep && (
            <span
              className={cn(
                "select-none opacity-50",
                fontSizeClasses[fontSize]
              )}
              aria-hidden="true"
            >
              {sep}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

export function MarqueeBar({
  items = [],
  speed = "normal",
  direction = "left",
  backgroundColor = "#000000",
  textColor = "#ffffff",
  pauseOnHover = true,
  fontSize = "sm",
  separator = "dot",
  basePath = "",
}: MarqueeBarProps & { basePath?: string }) {
  if (!items || items.length === 0) return null;

  const duration = speedDuration[speed];
  const animationDirection = direction === "right" ? "reverse" : "normal";

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ backgroundColor, color: textColor }}
    >
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-100%)}}`}</style>

      <div
        className={cn(
          "flex w-full overflow-hidden py-2.5 sm:py-3",
          pauseOnHover && "hover:[&>*]:[animation-play-state:paused]"
        )}
      >
        {/* First track (visible) */}
        <div
          className="flex shrink-0 items-center gap-x-6 sm:gap-x-8"
          style={{
            animation: `marquee ${duration}s linear infinite`,
            animationDirection,
          }}
          aria-hidden="false"
        >
          <MarqueeTrack
            items={items}
            separator={separator}
            fontSize={fontSize}
            basePath={basePath}
          />
        </div>

        {/* Duplicate track (creates seamless loop) */}
        <div
          className="flex shrink-0 items-center gap-x-6 sm:gap-x-8"
          style={{
            animation: `marquee ${duration}s linear infinite`,
            animationDirection,
          }}
          aria-hidden="true"
        >
          <MarqueeTrack
            items={items}
            separator={separator}
            fontSize={fontSize}
            basePath={basePath}
          />
        </div>
      </div>
    </section>
  );
}
