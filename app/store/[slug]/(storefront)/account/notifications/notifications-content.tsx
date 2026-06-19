"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Package,
  XCircle,
  Truck,
  PackageCheck,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/utils/safe-date";

interface CustomerNotificationsContentProps {
  tenantId: string;
  storeName: string;
  storeSlug: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  order_confirmed: Package,
  order_shipped: Truck,
  out_for_delivery: Truck,
  order_delivered: PackageCheck,
  order_cancelled: XCircle,
  back_in_stock: ShoppingBag,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  order_confirmed: "bg-blue-500",
  order_shipped: "bg-indigo-500",
  out_for_delivery: "bg-purple-500",
  order_delivered: "bg-green-500",
  order_cancelled: "bg-red-500",
  back_in_stock: "bg-amber-500",
};

const ITEMS_PER_PAGE = 20;

export function CustomerNotificationsContent({
  tenantId,
  storeName,
}: CustomerNotificationsContentProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = useCallback(
    async (reset = false) => {
      const currentOffset = reset ? 0 : offset;
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          tenantId,
          context: "customer",
          limit: ITEMS_PER_PAGE.toString(),
          offset: currentOffset.toString(),
        });

        const response = await fetch(`/api/notifications?${params}`);
        if (!response.ok) throw new Error("Failed to fetch");

        const data = await response.json();

        if (reset) {
          setNotifications(data.notifications);
          setOffset(ITEMS_PER_PAGE);
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
          setOffset((prev) => prev + ITEMS_PER_PAGE);
        }

        setUnreadCount(data.unreadCount);
        setHasMore(data.pagination.hasMore);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        toast.error("Failed to load notifications");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [tenantId, offset]
  );

  useEffect(() => {
    fetchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleRefresh = () => {
    fetchNotifications(true);
  };

  const handleLoadMore = () => {
    fetchNotifications(false);
  };

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
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const params = new URLSearchParams({ tenantId });

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
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const formatTime = (date: string) => {
    try {
      return safeFormatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Updates from {storeName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 sm:h-9"
            >
              <CheckCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No notifications yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              We&apos;ll notify you here when there are updates to your orders
              or when items you&apos;re interested in are back in stock.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
              const colorClass =
                NOTIFICATION_COLORS[notification.type] || "bg-muted-foreground";
              const isUnread = !notification.readAt;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 sm:gap-4 p-3 sm:p-4 transition-colors active:bg-muted/70",
                    isUnread && "bg-muted/50",
                    notification.actionUrl && "cursor-pointer hover:bg-muted/80"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "shrink-0 rounded-full p-1.5 sm:p-2 text-white",
                      colorClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-[13px] sm:text-sm font-medium",
                              isUnread
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-xs sm:text-sm mt-0.5",
                            isUnread
                              ? "text-muted-foreground"
                              : "text-muted-foreground/70"
                          )}
                        >
                          {notification.body}
                        </p>
                        <span className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2 block">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>

                      {/* Mark as read button */}
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 -mr-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="flex justify-center py-4 border-t">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
