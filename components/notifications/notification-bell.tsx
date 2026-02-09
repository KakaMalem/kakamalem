"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
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
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
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
  const [isConnected, setIsConnected] = useState(false);

  // Track known notification IDs to detect new ones
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notifications from API (for initial load and refresh)
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

        // Update known IDs (for initial load, don't play sounds)
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

  // Handle incoming SSE notification
  const handleSSENotification = useCallback(
    (notification: Notification) => {
      // Check if this notification matches our context filter
      const ownerTypes = [
        "new_order",
        "order_cancelled",
        "low_stock",
        "new_review",
      ];
      const customerTypes = [
        "order_confirmed",
        "order_shipped",
        "out_for_delivery",
        "order_delivered",
        "order_cancelled",
        "back_in_stock",
      ];

      if (context === "owner" && !ownerTypes.includes(notification.type)) {
        return;
      }
      if (
        context === "customer" &&
        !customerTypes.includes(notification.type)
      ) {
        return;
      }

      // Add to notifications list (at the beginning)
      setNotifications((prev) => {
        // Check if already exists
        if (prev.some((n) => n.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev].slice(0, 20); // Keep max 20
      });

      // Increment unread count if not read
      if (!notification.readAt) {
        setUnreadCount((prev) => prev + 1);
      }

      // Play sound for new notification
      if (!knownNotificationIds.current.has(notification.id)) {
        const soundType = mapNotificationTypeToSound(notification.type);
        playNotificationSound(soundType);
        knownNotificationIds.current.add(notification.id);
      }
    },
    [context]
  );

  // Setup SSE connection
  useEffect(() => {
    if (!isMounted) return;

    const connectSSE = () => {
      // Build SSE URL
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      const url = `/api/notifications/stream?${params}`;

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[SSE] Connected to notification stream");
        setIsConnected(true);
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            console.log("[SSE] Connection acknowledged:", data);
            return;
          }

          if (data.type === "notification" && data.notification) {
            handleSSENotification(data.notification);
          }
        } catch (error) {
          console.error("[SSE] Failed to parse message:", error);
        }
      };

      eventSource.onerror = () => {
        console.log("[SSE] Connection error, will reconnect...");
        setIsConnected(false);
        eventSource.close();

        // Reconnect after 5 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connectSSE();
          }, 5000);
        }
      };
    };

    // Initial fetch
    fetchNotifications();

    // Connect to SSE
    connectSSE();

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isMounted, tenantId, fetchNotifications, handleSSENotification]);

  // Refresh notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

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
          {/* Connection indicator */}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background",
              isConnected ? "bg-green-500" : "bg-yellow-500"
            )}
            title={isConnected ? "Real-time connected" : "Reconnecting..."}
          />
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
