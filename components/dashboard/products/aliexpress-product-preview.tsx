"use client";

import { useState } from "react";
import {
  Star,
  ExternalLink,
  Tag,
  Layers,
  ImageIcon,
  Info,
  Store,
  ShoppingCart,
  Truck,
} from "lucide-react";

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

import type { AliExpressProduct } from "@/lib/aliexpress/types";

interface AliExpressProductPreviewProps {
  product: AliExpressProduct;
}

export function AliExpressProductPreview({
  product,
}: AliExpressProductPreviewProps) {
  const [selectedImage, setSelectedImage] = useState(0);

  const imageUrls = product.images
    .map((img) => img.url)
    .filter((url): url is string => url !== null && url !== undefined);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg leading-tight">
              {product.title}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              {product.storeName && (
                <span className="flex items-center gap-1">
                  <Store className="size-3.5" />
                  {product.storeName}
                </span>
              )}
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
              {product.orderCount !== null && product.orderCount > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <ShoppingCart className="size-3" />
                  {product.orderCount.toLocaleString()} sold
                </span>
              )}
              <Badge variant="outline" className="font-mono text-xs">
                {product.productId}
              </Badge>
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
              {product.originalPrice !== null && (
                <span className="text-lg text-muted-foreground line-through">
                  {product.currency} {product.originalPrice.toFixed(2)}
                </span>
              )}
              {product.originalPrice !== null && product.price !== null && (
                <Badge variant="destructive" className="text-xs">
                  {Math.round(
                    ((product.originalPrice - product.price) /
                      product.originalPrice) *
                      100
                  )}
                  % off
                </Badge>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Price not available</span>
          )}
        </div>

        {/* Shipping info */}
        {product.shippingInfo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="size-4" />
            {product.shippingInfo}
          </div>
        )}

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
                            className="gap-1 text-xs"
                          >
                            {val.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={val.imageUrl}
                                alt={val.value}
                                className="h-4 w-4 rounded-sm object-cover"
                              />
                            )}
                            {val.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Show variant pricing if available */}
                  {product.variants.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        SKU Details
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {product.variants.slice(0, 12).map((variant, vIdx) => (
                          <div
                            key={vIdx}
                            className="flex items-center gap-2 rounded-md border p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {Object.values(variant.options).join(" / ") ||
                                  `SKU ${variant.skuId}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Stock: {variant.stock}
                                {variant.price !== null &&
                                  ` · ${product.currency} ${variant.price}`}
                                {!variant.available && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-1 text-[10px]"
                                  >
                                    Unavailable
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
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

          {/* Features */}
          {product.features.length > 0 && (
            <AccordionItem value="features">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Tag className="size-4" />
                  Features ({product.features.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {product.features.map((feat, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                      {feat}
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
