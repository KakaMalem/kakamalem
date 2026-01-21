import Link from "next/link";
import Image from "next/image";
import { Grid3X3, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    productCount: number;
  };
  storeSlug: string;
  className?: string;
}

export function CategoryCard({
  category,
  storeSlug,
  className,
}: CategoryCardProps) {
  return (
    <Link
      href={`/store/${storeSlug}/category/${category.slug}`}
      className={cn("group block", className)}
    >
      <article className="relative h-full overflow-hidden rounded-2xl bg-muted/30 transition-all duration-500 hover:shadow-2xl hover:shadow-black/10">
        {/* Category Image */}
        <div className="relative aspect-4/3 overflow-hidden">
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              className="object-cover transition-all duration-700 ease-out group-hover:scale-110"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
              <Grid3X3 className="size-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Gradient Overlay - stronger on hover */}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent transition-all duration-500 group-hover:from-black/90 group-hover:via-black/50" />

          {/* Product count badge */}
          <div className="absolute right-3 top-3">
            <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
              {category.productCount}{" "}
              {category.productCount === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Content Overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-5">
            <div className="translate-y-2 transition-transform duration-500 group-hover:translate-y-0">
              <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
                {category.name}
              </h3>
              {category.description && (
                <p className="mt-1 text-sm text-white/70 line-clamp-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {category.description}
                </p>
              )}
            </div>

            {/* Browse link - appears on hover with slide animation */}
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-white opacity-0 -translate-x-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-x-0">
              <span className="border-b border-white/50 pb-0.5">
                Browse collection
              </span>
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
