"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  reviews,
  reviewMedia,
  reviewVotes,
  orders,
  orderItems,
  products,
  tenants,
} from "@/lib/db/schema";
import { getUser } from "@/lib/auth/server";
import {
  reviewSchema,
  reviewVoteSchema,
  reviewReplySchema,
  type ReviewInput,
} from "@/lib/validations/reviews";
import { hasMinimumRole } from "@/lib/auth/context";
import { sendNewReviewNotification } from "@/lib/push";

// =============================================================================
// REVIEW SERVER ACTIONS
// =============================================================================

/**
 * Submit a new product review
 */
export async function submitReviewAction(
  tenantId: string,
  productId: string,
  orderId: string | null,
  input: ReviewInput
) {
  const user = await getUser();
  if (!user) {
    return {
      error: { message: "Please log in to submit a review" },
    };
  }

  // Validate input
  const validation = reviewSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0]?.message || "Invalid input",
      },
    };
  }

  const { rating, title, comment, mediaIds } = validation.data;

  try {
    // Check if user has already reviewed this product
    if (orderId) {
      // For verified purchase reviews, check per order
      const existingReview = await db.query.reviews.findFirst({
        where: and(
          eq(reviews.tenantId, tenantId),
          eq(reviews.productId, productId),
          eq(reviews.orderId, orderId)
        ),
      });

      if (existingReview) {
        return {
          error: {
            message: "You have already reviewed this product for this order",
          },
        };
      }
    } else {
      // For non-verified reviews, only allow one review per user per product
      const existingReview = await db.query.reviews.findFirst({
        where: and(
          eq(reviews.tenantId, tenantId),
          eq(reviews.productId, productId),
          eq(reviews.userId, user.id)
        ),
      });

      if (existingReview) {
        return {
          error: { message: "You have already reviewed this product" },
        };
      }
    }

    // Verify purchase if orderId is provided
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await db.query.orders.findFirst({
        where: and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          eq(orders.userId, user.id)
        ),
        with: {
          items: true,
        },
      });

      if (order) {
        // Check if the product was in this order
        const hasProduct = order.items.some(
          (item) => item.productId === productId
        );
        if (hasProduct && order.status === "delivered") {
          isVerifiedPurchase = true;
        }
      }
    }

    // Create customer snapshot
    const customerSnapshot = {
      name: user.name || "Anonymous",
      email: user.email,
      phone: undefined,
    };

    // Create the review
    const [newReview] = await db
      .insert(reviews)
      .values({
        tenantId,
        productId,
        orderId: orderId || null,
        userId: user.id,
        customerSnapshot,
        rating,
        title: title || null,
        comment: comment || null,
        isVerifiedPurchase,
      })
      .returning();

    // Add media if provided
    if (mediaIds.length > 0) {
      await db.insert(reviewMedia).values(
        mediaIds.map((mediaId, index) => ({
          tenantId,
          reviewId: newReview.id,
          mediaId,
          position: index,
        }))
      );
    }

    // Send notification to store staff
    const [product, tenant] = await Promise.all([
      db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: { name: true },
      }),
      db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
        columns: { slug: true, name: true },
      }),
    ]);

    if (product && tenant) {
      sendNewReviewNotification(tenantId, tenant.slug, {
        reviewId: newReview.id,
        productId,
        productName: product.name,
        customerName: user.name || "Customer",
        rating,
        comment: comment || undefined,
        storeName: tenant.name,
      }).catch(console.error);
    }

    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { data: newReview };
  } catch (error) {
    console.error("Failed to submit review:", error);
    return { error: { message: "Failed to submit review" } };
  }
}

/**
 * Vote on a review (helpful/not helpful)
 */
export async function voteOnReviewAction(
  tenantId: string,
  reviewId: string,
  isHelpful: boolean
) {
  const user = await getUser();
  if (!user) {
    return {
      error: { message: "Please log in to vote on reviews" },
    };
  }

  // Validate input
  const validation = reviewVoteSchema.safeParse({ reviewId, isHelpful });
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0]?.message || "Invalid input",
      },
    };
  }

  try {
    // Check if review exists
    const review = await db.query.reviews.findFirst({
      where: and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenantId)),
    });

    if (!review) {
      return { error: { message: "Review not found" } };
    }

    // Check if user has already voted
    const existingVote = await db.query.reviewVotes.findFirst({
      where: and(
        eq(reviewVotes.reviewId, reviewId),
        eq(reviewVotes.userId, user.id)
      ),
    });

    if (existingVote) {
      if (existingVote.isHelpful === isHelpful) {
        // Same vote - remove it (toggle off)
        await db.delete(reviewVotes).where(eq(reviewVotes.id, existingVote.id));

        // Update denormalized count
        if (isHelpful) {
          await db
            .update(reviews)
            .set({
              helpfulVotesUp: sql`${reviews.helpfulVotesUp} - 1`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(reviews.id, reviewId));
        } else {
          await db
            .update(reviews)
            .set({
              helpfulVotesDown: sql`${reviews.helpfulVotesDown} - 1`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(reviews.id, reviewId));
        }

        revalidatePath("/store/[slug]/product/[productSlug]", "page");
        return { data: { action: "removed" as const } };
      } else {
        // Different vote - update it
        await db
          .update(reviewVotes)
          .set({ isHelpful })
          .where(eq(reviewVotes.id, existingVote.id));

        // Update denormalized counts (swap)
        if (isHelpful) {
          await db
            .update(reviews)
            .set({
              helpfulVotesUp: sql`${reviews.helpfulVotesUp} + 1`,
              helpfulVotesDown: sql`${reviews.helpfulVotesDown} - 1`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(reviews.id, reviewId));
        } else {
          await db
            .update(reviews)
            .set({
              helpfulVotesUp: sql`${reviews.helpfulVotesUp} - 1`,
              helpfulVotesDown: sql`${reviews.helpfulVotesDown} + 1`,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(reviews.id, reviewId));
        }

        revalidatePath("/store/[slug]/product/[productSlug]", "page");
        return { data: { action: "changed" as const } };
      }
    }

    // Create new vote
    await db.insert(reviewVotes).values({
      tenantId,
      reviewId,
      userId: user.id,
      isHelpful,
    });

    // Update denormalized count
    if (isHelpful) {
      await db
        .update(reviews)
        .set({
          helpfulVotesUp: sql`${reviews.helpfulVotesUp} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(reviews.id, reviewId));
    } else {
      await db
        .update(reviews)
        .set({
          helpfulVotesDown: sql`${reviews.helpfulVotesDown} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(reviews.id, reviewId));
    }

    revalidatePath("/store/[slug]/product/[productSlug]", "page");
    return { data: { action: "added" as const } };
  } catch (error) {
    console.error("Failed to vote on review:", error);
    return { error: { message: "Failed to vote on review" } };
  }
}

/**
 * Get user's vote on a review
 */
export async function getUserReviewVoteAction(reviewId: string) {
  const user = await getUser();
  if (!user) {
    return { data: null };
  }

  try {
    const vote = await db.query.reviewVotes.findFirst({
      where: and(
        eq(reviewVotes.reviewId, reviewId),
        eq(reviewVotes.userId, user.id)
      ),
    });

    return { data: vote };
  } catch (error) {
    console.error("Failed to get user vote:", error);
    return { data: null };
  }
}

/**
 * Reply to a review (store owner/admin only)
 */
export async function replyToReviewAction(
  tenantId: string,
  reviewId: string,
  replyContent: string
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  // Check if user has permission to reply (owner/admin)
  const hasPermission = await hasMinimumRole(tenantId, "admin");
  if (!hasPermission) {
    return {
      error: { message: "You don't have permission to reply to reviews" },
    };
  }

  // Validate input
  const validation = reviewReplySchema.safeParse({ reviewId, replyContent });
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0]?.message || "Invalid input",
      },
    };
  }

  try {
    // Check if review exists
    const review = await db.query.reviews.findFirst({
      where: and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenantId)),
    });

    if (!review) {
      return { error: { message: "Review not found" } };
    }

    // Update the review with reply
    await db
      .update(reviews)
      .set({
        replyContent,
        repliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(reviews.id, reviewId));

    revalidatePath("/store/[slug]/product/[productSlug]", "page");
    revalidatePath("/dashboard/[slug]/reviews", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to reply to review:", error);
    return { error: { message: "Failed to reply to review" } };
  }
}

/**
 * Delete a review reply (store owner/admin only)
 */
export async function deleteReviewReplyAction(
  tenantId: string,
  reviewId: string
) {
  const user = await getUser();
  if (!user) {
    return { error: { message: "Not authenticated" } };
  }

  // Check if user has permission
  const hasPermission = await hasMinimumRole(tenantId, "admin");
  if (!hasPermission) {
    return {
      error: { message: "You don't have permission to delete replies" },
    };
  }

  try {
    await db
      .update(reviews)
      .set({
        replyContent: null,
        repliedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(reviews.id, reviewId), eq(reviews.tenantId, tenantId)));

    revalidatePath("/store/[slug]/product/[productSlug]", "page");
    revalidatePath("/dashboard/[slug]/reviews", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete reply:", error);
    return { error: { message: "Failed to delete reply" } };
  }
}

/**
 * Edit an existing review (user can only edit their own review)
 */
export async function editReviewAction(
  tenantId: string,
  reviewId: string,
  input: ReviewInput & {
    keepMediaIds?: string[]; // Media IDs to keep (from existing images)
  }
) {
  const user = await getUser();
  if (!user) {
    return {
      error: { message: "Please log in to edit your review" },
    };
  }

  // Validate input
  const validation = reviewSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: {
        message: validation.error.issues[0]?.message || "Invalid input",
      },
    };
  }

  const { rating, title, comment, mediaIds = [] } = validation.data;
  const keepMediaIds = input.keepMediaIds || [];

  try {
    // Check if review exists and belongs to user
    const review = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.id, reviewId),
        eq(reviews.tenantId, tenantId),
        eq(reviews.userId, user.id)
      ),
      with: {
        images: true,
      },
    });

    if (!review) {
      return {
        error: {
          message: "Review not found or you don't have permission to edit it",
        },
      };
    }

    // Get current media IDs
    const currentMediaIds = review.images.map((img) => img.mediaId);

    // Determine which media to remove (current - keep)
    const mediaToRemove = currentMediaIds.filter(
      (id) => !keepMediaIds.includes(id)
    );

    // Remove images that are no longer wanted
    if (mediaToRemove.length > 0) {
      await db.delete(reviewMedia).where(
        and(
          eq(reviewMedia.reviewId, reviewId),
          sql`${reviewMedia.mediaId} IN (${sql.join(
            mediaToRemove.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      );
    }

    // Add new images (mediaIds that aren't in current)
    const newMediaIds = mediaIds.filter((id) => !currentMediaIds.includes(id));
    if (newMediaIds.length > 0) {
      // Get current max position
      const maxPosition = Math.max(
        0,
        ...review.images
          .filter((img) => keepMediaIds.includes(img.mediaId))
          .map((img) => img.position)
      );

      await db.insert(reviewMedia).values(
        newMediaIds.map((mediaId, index) => ({
          tenantId,
          reviewId,
          mediaId,
          position: maxPosition + index + 1,
        }))
      );
    }

    // Update the review
    const [updatedReview] = await db
      .update(reviews)
      .set({
        rating,
        title: title || null,
        comment: comment || null,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { data: updatedReview };
  } catch (error) {
    console.error("Failed to edit review:", error);
    return { error: { message: "Failed to edit review" } };
  }
}

/**
 * Delete a review (user can only delete their own review)
 */
export async function deleteReviewAction(tenantId: string, reviewId: string) {
  const user = await getUser();
  if (!user) {
    return {
      error: { message: "Please log in to delete your review" },
    };
  }

  try {
    // Check if review exists and belongs to user
    const review = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.id, reviewId),
        eq(reviews.tenantId, tenantId),
        eq(reviews.userId, user.id)
      ),
    });

    if (!review) {
      return {
        error: {
          message: "Review not found or you don't have permission to delete it",
        },
      };
    }

    // Delete associated data first (votes and media)
    await db.delete(reviewVotes).where(eq(reviewVotes.reviewId, reviewId));
    await db.delete(reviewMedia).where(eq(reviewMedia.reviewId, reviewId));

    // Delete the review
    await db.delete(reviews).where(eq(reviews.id, reviewId));

    revalidatePath("/store/[slug]/product/[productSlug]", "page");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete review:", error);
    return { error: { message: "Failed to delete review" } };
  }
}

/**
 * Check if user can review a product
 * Returns:
 * - canReview: true if user can leave a review
 * - eligibleOrderIds: array of order IDs for verified purchase reviews
 * - reason: why user can't review (if applicable)
 */
export async function canReviewProductAction(
  tenantId: string,
  productId: string
) {
  const user = await getUser();
  if (!user) {
    return { data: { canReview: false, reason: "not_logged_in" as const } };
  }

  try {
    // Check if user has already reviewed this product (any review, verified or not)
    const existingReviews = await db.query.reviews.findMany({
      where: and(
        eq(reviews.tenantId, tenantId),
        eq(reviews.productId, productId),
        eq(reviews.userId, user.id)
      ),
    });

    // Find delivered orders with this product
    const eligibleOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.tenantId, tenantId),
        eq(orders.userId, user.id),
        eq(orders.status, "delivered")
      ),
      with: {
        items: {
          where: eq(orderItems.productId, productId),
        },
      },
    });

    // Filter to orders that have this product
    const ordersWithProduct = eligibleOrders.filter(
      (order) => order.items.length > 0
    );

    // Find which orders haven't been reviewed yet
    const reviewedOrderIds = new Set(
      existingReviews.map((r) => r.orderId).filter(Boolean)
    );
    const unreviewedOrders = ordersWithProduct.filter(
      (order) => !reviewedOrderIds.has(order.id)
    );

    // If user has verified purchase orders that aren't reviewed, they can review those
    if (unreviewedOrders.length > 0) {
      return {
        data: {
          canReview: true,
          eligibleOrderIds: unreviewedOrders.map((o) => o.id),
        },
      };
    }

    // If user has no unreviewied orders but has already reviewed (verified or not)
    if (existingReviews.length > 0) {
      return {
        data: { canReview: false, reason: "already_reviewed" as const },
      };
    }

    // User hasn't reviewed and doesn't have a verified purchase
    // They can still leave a non-verified review
    return {
      data: {
        canReview: true,
        eligibleOrderIds: [],
        reason: "no_purchase" as const,
      },
    };
  } catch (error) {
    console.error("Failed to check review eligibility:", error);
    return { data: { canReview: false, reason: "error" as const } };
  }
}
