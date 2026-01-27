"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  playNotificationSound,
  mapNotificationTypeToSound,
} from "@/lib/hooks/use-notification-sound";

// Custom hook to detect client-side mounting (prevents hydration mismatch)
function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);
  return isMounted;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  avatarUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  tenantId?: string;
  className?: string;
  /** URL for "View all notifications" link. Defaults to /dashboard/notifications */
  viewAllUrl?: string;
  /** Context for filtering notifications: "owner" for store owners, "customer" for customers */
  context?: "owner" | "customer";
}

export function NotificationBell({
  tenantId,
  className,
  viewAllUrl = "/dashboard/notifications",
  context,
}: NotificationBellProps) {
  const isMounted = useIsMounted();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Track known notification IDs to detect new ones
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      if (context) params.set("context", context);
      params.set("limit", "20");

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const data = await response.json();
        const newNotifications: Notification[] = data.notifications;

        // Check for new unread notifications (not on initial load)
        if (!isInitialLoad.current) {
          for (const notification of newNotifications) {
            // Play sound for new unread notifications we haven't seen
            if (
              !notification.readAt &&
              !knownNotificationIds.current.has(notification.id)
            ) {
              const soundType = mapNotificationTypeToSound(notification.type);
              playNotificationSound(soundType);
              break; // Only play once per fetch cycle
            }
          }
        }

        // Update known IDs
        knownNotificationIds.current = new Set(
          newNotifications.map((n) => n.id)
        );
        isInitialLoad.current = false;

        setNotifications(newNotifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, context]);

  // Fetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);

      await fetch(`/api/notifications/read-all?${params}`, {
        method: "POST",
      });

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.readAt) {
      markAsRead(notification.id);
    }

    // Close the popover
    setIsOpen(false);

    // Navigate to action URL if available
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const getNotificationColor = (type: string) => {
    // Colors matched across all notification contexts
    switch (type) {
      // Store owner notifications
      case "new_order":
        return "bg-green-500";
      case "order_cancelled":
        return "bg-red-500";
      case "low_stock":
        return "bg-amber-500";
      case "new_review":
        return "bg-blue-500";
      // Customer notifications
      case "order_confirmed":
        return "bg-blue-500";
      case "order_shipped":
        return "bg-indigo-500";
      case "out_for_delivery":
        return "bg-purple-500";
      case "order_delivered":
        return "bg-green-500";
      case "back_in_stock":
        return "bg-amber-500";
      default:
        return "bg-muted-foreground";
    }
  };

  // Render a static placeholder during SSR to avoid hydration mismatch
  // Radix Popover generates different IDs on server vs client
  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative", className)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-95 max-w-95 p-0"
        align="end"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="flex items-center justify-between border-b px-3 sm:px-4 py-2.5 sm:py-3">
          <h3 className="font-semibold text-sm sm:text-base">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-1.5 sm:px-2 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Mark all</span>
            </Button>
          )}
        </div>

        <ScrollArea className="h-[min(400px,60vh)]">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                We&apos;ll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors active:bg-muted/70",
                    notification.actionUrl && "cursor-pointer",
                    !notification.readAt && "bg-muted/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Unread indicator */}
                  {!notification.readAt && (
                    <div className="absolute left-1 sm:left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}

                  {/* Type indicator */}
                  <div
                    className={cn(
                      "mt-0.5 h-2 w-2 rounded-full shrink-0",
                      getNotificationColor(notification.type)
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                    <span className="text-[10px] text-muted-foreground mt-1 sm:mt-1.5 block">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {!notification.readAt && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 -mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-3 sm:px-4 py-2">
          <Link
            href={viewAllUrl}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setIsOpen(false)}
          >
            View all notifications →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
