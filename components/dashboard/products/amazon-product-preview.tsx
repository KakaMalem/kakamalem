"use client";

import { useState } from "react";
import { Star, ExternalLink, Tag, Layers, ImageIcon, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type { AmazonProduct } from "@/lib/amazon/types";

interface AmazonProductPreviewProps {
  product: AmazonProduct;
}

export function AmazonProductPreview({ product }: AmazonProductPreviewProps) {
  const [selectedImage, setSelectedImage] = useState(0);

  const imageUrls = product.images
    .map((img) => img.hiRes || img.large || img.thumb)
    .filter((url): url is string => url !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg leading-tight">
              {product.title}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              {product.brand && <span>by {product.brand}</span>}
              {product.rating !== null && (
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                  {product.rating.toFixed(1)}
                  {product.reviewCount !== null && (
                    <span className="text-xs">
                      ({product.reviewCount.toLocaleString()} reviews)
                    </span>
                  )}
                </span>
              )}
              <Badge variant="outline">{product.asin}</Badge>
            </CardDescription>
          </div>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price */}
        <div className="flex items-baseline gap-3">
          {product.price !== null ? (
            <>
              <span className="text-2xl font-bold">
                {product.currency} {product.price.toFixed(2)}
              </span>
              {product.compareAtPrice !== null && (
                <span className="text-lg text-muted-foreground line-through">
                  {product.currency} {product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Price not available</span>
          )}
        </div>

        {/* Images */}
        {imageUrls.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="size-4" />
              Images ({imageUrls.length})
            </h4>

            {/* Selected image */}
            <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[selectedImage]}
                alt={`${product.title} - Image ${selectedImage + 1}`}
                className="h-full w-full object-contain"
              />
            </div>

            {/* Thumbnail strip */}
            {imageUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imageUrls.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`shrink-0 overflow-hidden rounded-md border-2 ${
                      selectedImage === index
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-16 w-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expandable sections */}
        <Accordion type="multiple" defaultValue={["variants", "features"]}>
          {/* Variant Options */}
          {product.variantOptions.length > 0 && (
            <AccordionItem value="variants">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Layers className="size-4" />
                  Variants ({product.variantOptions.length} option
                  {product.variantOptions.length !== 1 ? "s" : ""}
                  {product.variants.length > 0 &&
                    `, ${product.variants.length} combination${product.variants.length !== 1 ? "s" : ""}`}
                  )
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Option names and values */}
                  {product.variantOptions.map((option, optIndex) => (
                    <div key={optIndex}>
                      <p className="mb-1.5 text-sm font-medium">
                        {option.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {option.values.map((val, valIndex) => (
                          <Badge
                            key={valIndex}
                            variant="secondary"
                            className="text-xs"
                          >
                            {val.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Show variants with their images */}
                  {product.variants.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Variant Details
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {product.variants.slice(0, 12).map((variant, vIdx) => {
                          const variantImgUrl =
                            variant.images[0]?.hiRes ||
                            variant.images[0]?.large ||
                            variant.images[0]?.thumb;
                          return (
                            <div
                              key={vIdx}
                              className="flex items-center gap-2 rounded-md border p-2"
                            >
                              {variantImgUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={variantImgUrl}
                                  alt={variant.title}
                                  className="h-10 w-10 shrink-0 rounded object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {variant.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {variant.images.length} image
                                  {variant.images.length !== 1 ? "s" : ""}
                                  {variant.price !== null &&
                                    ` · ${product.currency} ${variant.price}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {product.variants.length > 12 && (
                        <p className="text-xs text-muted-foreground">
                          ...and {product.variants.length - 12} more variants
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Feature Bullets */}
          {product.featureBullets.length > 0 && (
            <AccordionItem value="features">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Tag className="size-4" />
                  Features ({product.featureBullets.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {product.featureBullets.map((bullet, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Specifications */}
          {Object.keys(product.specifications).length > 0 && (
            <AccordionItem value="specs">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Info className="size-4" />
                  Specifications ({Object.keys(product.specifications).length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(product.specifications).map(
                        ([key, value], index) => (
                          <tr
                            key={index}
                            className={index % 2 === 0 ? "bg-muted/30" : ""}
                          >
                            <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                              {key}
                            </td>
                            <td className="px-3 py-2">{value}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Description */}
          {product.description && (
            <AccordionItem value="description">
              <AccordionTrigger className="text-sm font-medium">
                Description
              </AccordionTrigger>
              <AccordionContent>
                <div
                  className="prose prose-sm max-w-none text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
