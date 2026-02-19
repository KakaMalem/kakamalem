"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  playNotificationSound,
  mapNotificationTypeToSound,
} from "@/lib/hooks/use-notification-sound";

// Prevent hydration mismatch
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  tenantId?: string;
  className?: string;
  viewAllUrl?: string;
  context?: "owner" | "customer";
}

async function fetchUnreadCount(
  context?: string,
  tenantId?: string
): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (context) params.set("context", context);
  if (tenantId) params.set("tenantId", tenantId);
  const res = await fetch(`/api/notifications/unread-count?${params}`);
  if (!res.ok) return { count: 0 };
  return res.json();
}

async function fetchNotifications(
  context?: string,
  tenantId?: string
): Promise<{ notifications: NotificationItem[] }> {
  const params = new URLSearchParams({ limit: "20", offset: "0" });
  if (context) params.set("context", context);
  if (tenantId) params.set("tenantId", tenantId);
  const res = await fetch(`/api/notifications?${params}`);
  if (!res.ok) return { notifications: [] };
  return res.json();
}

function getNotificationColor(type: string) {
  switch (type) {
    case "new_order":
      return "bg-green-500";
    case "order_cancelled":
      return "bg-red-500";
    case "low_stock":
      return "bg-amber-500";
    case "new_review":
      return "bg-blue-500";
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
}

export function NotificationBell({
  tenantId,
  className,
  viewAllUrl = "/dashboard/notifications",
  context,
}: NotificationBellProps) {
  const isMounted = useIsMounted();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const prevCountRef = useRef<number>(0);
  const isInitialLoad = useRef(true);

  // Poll unread count every 15 seconds
  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count", context, tenantId],
    queryFn: () => fetchUnreadCount(context, tenantId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  const unreadCount = unreadData?.count ?? 0;

  // Play sound only when unread count genuinely increases (not on initial page load)
  useEffect(() => {
    // Wait until the first real API response arrives
    if (unreadData === undefined) return;

    if (isInitialLoad.current) {
      // First real data — store as baseline, don't play sound
      prevCountRef.current = unreadCount;
      isInitialLoad.current = false;
      return;
    }

    if (unreadCount > prevCountRef.current) {
      // Fetch latest notification to determine the correct sound type
      fetchNotifications(context, tenantId)
        .then((data) => {
          const latest = data.notifications[0];
          const soundType = latest
            ? mapNotificationTypeToSound(
                ((latest.data as Record<string, unknown>)
                  ?.soundType as string) || latest.type
              )
            : "default";
          playNotificationSound(soundType);
        })
        .catch(() => {
          playNotificationSound("default");
        });
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, unreadData, context, tenantId]);

  // Fetch notification list when popover is open
  const { data: notifData, isLoading } = useQuery({
    queryKey: ["notifications", "list", context, tenantId],
    queryFn: () => fetchNotifications(context, tenantId),
    enabled: isOpen,
    staleTime: 10_000,
  });

  const notificationsList = notifData?.notifications ?? [];

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      if (context) params.set("context", context);
      return fetch(`/api/notifications/read-all?${params}`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      if (!notification.readAt) {
        markReadMutation.mutate(notification.id);
      }
      setIsOpen(false);
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
    },
    [router, markReadMutation]
  );

  // SSR placeholder
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
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCheck className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Mark all</span>
            </Button>
          )}
        </div>

        <ScrollArea className="h-[min(400px,60vh)]">
          {isLoading && notificationsList.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notificationsList.length === 0 ? (
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
              {notificationsList.map((notification) => {
                const isUnread = !notification.readAt;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "relative flex gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/50 transition-colors active:bg-muted/70",
                      notification.actionUrl && "cursor-pointer",
                      isUnread && "bg-muted/30"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread indicator */}
                    {isUnread && (
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

                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 -mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate(notification.id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
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
