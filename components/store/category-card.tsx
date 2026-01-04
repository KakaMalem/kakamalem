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
      <article className="relative h-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        {/* Category Image */}
        <div className="relative aspect-4/3 overflow-hidden">
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
              <Grid3X3 className="size-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90" />

          {/* Content Overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <div className="translate-y-1 transition-transform duration-300 group-hover:translate-y-0">
              <h3 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                {category.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/80">
                {category.productCount}{" "}
                {category.productCount === 1 ? "product" : "products"}
              </p>
            </div>

            {/* Browse link - appears on hover */}
            <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-white/90 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <span>Browse collection</span>
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
