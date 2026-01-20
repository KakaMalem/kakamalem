"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Package, ShoppingCart } from "lucide-react";

type CartErrorType =
  | "validation" // Cart validation failed (stock issues, unavailable items)
  | "checkout" // Checkout process failed
  | "empty" // Cart is empty
  | "session"; // Session issue

interface CartError {
  itemId?: string;
  productName?: string;
  error: string;
}

// Helper to clean error params from URL
function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("error");
  url.searchParams.delete("errors");
  window.history.replaceState({}, "", url.pathname);
}

// Helper to show validation errors as toasts
function showValidationErrors(errors: CartError[]) {
  if (errors.length === 0) {
    toast.error("Cart validation failed", {
      description:
        "Some items in your cart are no longer available or have insufficient stock.",
      icon: <Package className="h-5 w-5" />,
      duration: 6000,
    });
    return;
  }

  // Group errors by type for cleaner display
  const stockErrors = errors.filter(
    (e) => e.error.includes("stock") || e.error.includes("available")
  );
  const unavailableErrors = errors.filter((e) =>
    e.error.includes("no longer available")
  );

  // Show a summary toast first
  if (errors.length === 1) {
    const err = errors[0];
    toast.error(err.productName || "Item issue", {
      description: err.error,
      icon: <Package className="h-5 w-5" />,
      duration: 6000,
    });
  } else {
    // Multiple errors - show summary
    toast.error(`${errors.length} items need attention`, {
      description:
        "Please review your cart and update quantities or remove unavailable items.",
      icon: <ShoppingCart className="h-5 w-5" />,
      duration: 6000,
    });

    // Show individual errors with slight delay for each
    errors.slice(0, 3).forEach((err, index) => {
      setTimeout(
        () => {
          if (unavailableErrors.includes(err)) {
            toast.warning(err.productName || "Product unavailable", {
              description: err.error,
              icon: <Package className="h-5 w-5" />,
              duration: 5000,
            });
          } else if (stockErrors.includes(err)) {
            toast.warning(err.productName || "Stock issue", {
              description: err.error,
              icon: <Package className="h-5 w-5" />,
              duration: 5000,
            });
          }
        },
        (index + 1) * 300
      );
    });

    // If there are more than 3 errors, show a "+N more" toast
    if (errors.length > 3) {
      setTimeout(() => {
        toast.info(`+${errors.length - 3} more items with issues`, {
          description: "Please review all items in your cart.",
          duration: 4000,
        });
      }, 4 * 300);
    }
  }
}

/**
 * Component that reads error information from URL params and shows toast notifications
 * Automatically clears the URL params after showing the toasts
 */
export function CartErrorToast() {
  const searchParams = useSearchParams();
  const hasShownToast = useRef(false);

  useEffect(() => {
    // Prevent showing toasts multiple times
    if (hasShownToast.current) return;

    const errorType = searchParams.get("error") as CartErrorType | null;
    const errorsParam = searchParams.get("errors");

    if (!errorType && !errorsParam) return;

    hasShownToast.current = true;

    // Handle legacy ?errors=true format (just re-validate message)
    if (errorsParam === "true" && !errorType) {
      toast.error("Some items in your cart need attention", {
        description:
          "Please review your cart and update quantities or remove unavailable items.",
        icon: <ShoppingCart className="h-5 w-5" />,
        duration: 6000,
      });
      cleanUrl();
      return;
    }

    // Parse detailed errors if available
    let errors: CartError[] = [];
    if (errorsParam && errorsParam !== "true") {
      try {
        errors = JSON.parse(decodeURIComponent(errorsParam));
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Show appropriate toast based on error type
    switch (errorType) {
      case "validation":
        showValidationErrors(errors);
        break;
      case "checkout":
        toast.error("Checkout failed", {
          description:
            "There was a problem processing your order. Please try again.",
          icon: <AlertCircle className="h-5 w-5" />,
          duration: 5000,
        });
        break;
      case "empty":
        toast.error("Your cart is empty", {
          description: "Add some items to your cart before checking out.",
          icon: <ShoppingCart className="h-5 w-5" />,
          duration: 4000,
        });
        break;
      case "session":
        toast.error("Session expired", {
          description:
            "Your shopping session has expired. Please add items to your cart again.",
          icon: <AlertCircle className="h-5 w-5" />,
          duration: 5000,
        });
        break;
      default:
        if (errors.length > 0) {
          showValidationErrors(errors);
        }
    }

    cleanUrl();
  }, [searchParams]);

  // This component doesn't render anything
  return null;
}
