import Image from "next/image";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestimonialsProps } from "@/lib/page-builder/types";

const gridColumnClasses: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-4 ${
            i < rating
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  showRating,
}: {
  testimonial: TestimonialsProps["testimonials"][number];
  showRating: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      {showRating && <StarRating rating={testimonial.rating} />}
      <blockquote className="flex-1 text-sm leading-relaxed text-foreground/80">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3">
        {testimonial.authorImageUrl ? (
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
            <Image
              src={testimonial.authorImageUrl}
              alt={testimonial.authorName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {testimonial.authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-medium">{testimonial.authorName}</p>
          {testimonial.authorRole && (
            <p className="text-xs text-muted-foreground">
              {testimonial.authorRole}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection(
  props: TestimonialsProps & { id: string; puck?: unknown }
) {
  const {
    title,
    subtitle,
    testimonials = [],
    layout,
    columns,
    showRating,
    backgroundColor,
  } = props;

  if (testimonials.length === 0) {
    return (
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed py-12 text-muted-foreground">
            Add testimonials to this section
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="py-12"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-8 text-center">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}

        {/* Grid layout */}
        {layout === "grid" && (
          <div
            className={cn(
              "grid gap-6",
              gridColumnClasses[columns] || gridColumnClasses[3]
            )}
          >
            {testimonials.map((t, i) => (
              <TestimonialCard
                key={i}
                testimonial={t}
                showRating={showRating}
              />
            ))}
          </div>
        )}

        {/* Carousel layout */}
        {layout === "carousel" && (
          <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto scrollbar-none pb-4">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="shrink-0 snap-start"
                style={{
                  width: `${Math.round(100 / Math.min(columns, testimonials.length))}%`,
                }}
              >
                <TestimonialCard testimonial={t} showRating={showRating} />
              </div>
            ))}
          </div>
        )}

        {/* Stacked layout */}
        {layout === "stacked" && (
          <div className="space-y-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div className="max-w-2xl">
                  <TestimonialCard testimonial={t} showRating={showRating} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
