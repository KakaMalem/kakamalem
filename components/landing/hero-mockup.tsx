"use client";

import { motion } from "framer-motion";
import { Search, ShoppingCart, User, Star, Heart } from "lucide-react";

const mockProducts = [
  {
    name: "Premium Saffron",
    price: "2,500",
    oldPrice: "3,000",
    discount: 17,
    rating: 4.8,
    reviews: 24,
    image: "bg-gradient-to-br from-amber-200 to-amber-400",
  },
  {
    name: "Afghan Carpet",
    price: "15,000",
    rating: 5.0,
    reviews: 12,
    image: "bg-gradient-to-br from-red-300 to-red-500",
  },
  {
    name: "Dried Fruits Mix",
    price: "800",
    oldPrice: "1,000",
    discount: 20,
    rating: 4.5,
    reviews: 45,
    image: "bg-gradient-to-br from-orange-200 to-orange-400",
    lowStock: true,
  },
  {
    name: "Handmade Jewelry",
    price: "3,200",
    rating: 4.9,
    reviews: 8,
    image: "bg-gradient-to-br from-blue-200 to-blue-400",
    isNew: true,
  },
];

const categories = ["All Products", "Food & Spices", "Handicrafts", "Clothing"];

export function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative"
    >
      {/* Floating animation wrapper */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Browser frame */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Browser toolbar */}
          <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-red-400" />
              <div className="size-3 rounded-full bg-yellow-400" />
              <div className="size-3 rounded-full bg-green-400" />
            </div>
            <div className="ml-4 flex-1">
              <div className="mx-auto flex max-w-md items-center gap-2 rounded-md bg-background px-3 py-1.5 text-xs text-muted-foreground">
                <div className="size-3 rounded-full bg-green-500" />
                <span>kakamalem.com/store/yourshop</span>
              </div>
            </div>
          </div>

          {/* Store content */}
          <div className="bg-background">
            {/* Store header */}
            <div className="border-b px-4 py-3">
              {/* Top row: Logo + Icons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    YS
                  </div>
                  <span className="font-semibold">Your Shop</span>
                </div>
                {/* Search bar - desktop only, inline */}
                <div className="mx-4 hidden flex-1 justify-center sm:flex">
                  <div className="flex w-full max-w-70 items-center gap-2 rounded-md border bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
                    <Search className="size-3" />
                    <span>Search products...</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart className="size-5 text-muted-foreground" />
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                      3
                    </span>
                  </div>
                  <User className="size-5 text-muted-foreground" />
                </div>
              </div>
              {/* Search bar - mobile only, below */}
              <div className="mt-3 sm:hidden">
                <div className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <Search className="size-3" />
                  <span>Search products...</span>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto border-b px-4 py-2">
              {categories.map((cat, i) => (
                <div
                  key={cat}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cat}
                </div>
              ))}
            </div>

            {/* Products grid */}
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {mockProducts.map((product) => (
                <div
                  key={product.name}
                  className="group overflow-hidden rounded-lg border bg-background shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Product image */}
                  <div className={`relative aspect-4/5 ${product.image}`}>
                    {/* Badges */}
                    <div className="absolute left-2 top-2 flex flex-col gap-1">
                      {product.isNew && (
                        <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          NEW
                        </span>
                      )}
                      {product.lowStock && (
                        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Low Stock
                        </span>
                      )}
                    </div>
                    {product.discount && (
                      <span className="absolute right-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        -{product.discount}%
                      </span>
                    )}
                    {/* Wishlist */}
                    <button className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                      <Heart className="size-3 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Product info */}
                  <div className="p-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold">{product.price}</span>
                      <span className="text-[10px] text-muted-foreground">
                        AFN
                      </span>
                      {product.oldPrice && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {product.oldPrice}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {product.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      <span className="text-[10px] font-medium">
                        {product.rating}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({product.reviews})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Decorative elements */}
      <div className="absolute -right-4 -top-4 -z-10 size-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute -bottom-4 -left-4 -z-10 size-32 rounded-full bg-primary/5 blur-3xl" />
    </motion.div>
  );
}
