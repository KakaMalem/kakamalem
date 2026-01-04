"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

interface ProductImageGalleryProps {
  images: {
    id: string;
    url: string;
    altText: string;
  }[];
  productName: string;
}

export function ProductImageGallery({
  images,
  productName,
}: ProductImageGalleryProps) {
  const [api, setApi] = useState<CarouselApi>();

  const handleThumbnailClick = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  if (images.length === 0) {
    return (
      <div className="aspect-4/5 overflow-hidden rounded-lg border border-border/50 bg-white">
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <ImageIcon className="size-20 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No image available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Main Carousel */}
      <div>
        <Carousel setApi={setApi} opts={{ loop: false }} className="w-full">
          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem key={image.id}>
                <div className="relative aspect-square overflow-hidden rounded-md bg-white border border-border/40">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image
                      src={image.url}
                      alt={image.altText || `${productName} - ${index + 1}`}
                      width={1200}
                      height={1200}
                      className="max-h-full max-w-full object-contain"
                      priority={index === 0}
                      style={{ width: "auto", height: "auto" }}
                    />
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Thumbnail Grid */}
      {images.length > 1 && (
        <div className="flex justify-between gap-6">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => handleThumbnailClick(index)}
              className="cursor-pointer overflow-hidden rounded-md transition-all duration-200 flex-1 border border-border/40 hover:border-border"
            >
              <div className="relative aspect-square bg-white">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src={image.url}
                    alt={`${productName} thumbnail ${index + 1}`}
                    width={200}
                    height={200}
                    className="max-h-full max-w-full object-contain"
                    style={{ width: "auto", height: "auto" }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
