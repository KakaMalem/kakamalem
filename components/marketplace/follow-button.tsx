"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followStore, unfollowStore } from "@/lib/actions/marketplace";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  tenantId: string;
  initialFollowing: boolean;
  className?: string;
  size?: "sm" | "default";
}

export function FollowButton({
  tenantId,
  initialFollowing,
  className,
  size = "sm",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const newState = !isFollowing;
    setIsFollowing(newState); // Optimistic update

    startTransition(async () => {
      const result = newState
        ? await followStore(tenantId)
        : await unfollowStore(tenantId);

      if (result.error) {
        setIsFollowing(!newState); // Revert on error
      }
    });
  }

  return (
    <Button
      variant={isFollowing ? "secondary" : "outline"}
      size={size}
      onClick={handleToggle}
      disabled={isPending}
      className={cn("gap-1.5", className)}
    >
      <Heart
        className={cn("size-3.5", isFollowing && "fill-red-500 text-red-500")}
      />
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
