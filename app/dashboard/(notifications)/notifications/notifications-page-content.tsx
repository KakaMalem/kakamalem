"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronLeft,
  MoreHorizontal,
  Package,
  XCircle,
  AlertTriangle,
  Star,
  Archive,
  RefreshCw,
  Store,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Store {
  id: string;
  name: string;
  slug: string;
}

interface NotificationsPageContentProps {
  stores: Store[];
}

interface Notification {
  id: string;
  userId: string;
  tenantId: string | null;
  tenantName: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  actionUrl: string | null;
  actionLabel: string | null;
  avatarUrl: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

type FilterType = "all" | "unread" | "read";

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  new_order: Package,
  order_cancelled: XCircle,
  low_stock: AlertTriangle,
  new_review: Star,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  new_order: "bg-green-500",
  order_cancelled: "bg-red-500",
  low_stock: "bg-amber-500",
  new_review: "bg-blue-500",
};

const ITEMS_PER_PAGE = 20;

export function NotificationsPageContent({
  stores,
}: NotificationsPageContentProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
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
          limit: ITEMS_PER_PAGE.toString(),
          offset: currentOffset.toString(),
          context: "owner", // Only show store owner notifications in dashboard
        });

        if (filter !== "all") {
          params.set("filter", filter);
        }

        if (selectedStore !== "all") {
          params.set("tenantId", selectedStore);
        }

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

        setTotalCount(data.totalCount);
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
    [filter, selectedStore, offset]
  );

  useEffect(() => {
    fetchNotifications(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedStore]);

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
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStore !== "all") {
        params.set("tenantId", selectedStore);
      }

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

  const archiveNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/archive`, {
        method: "POST",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setTotalCount((prev) => prev - 1);
      toast.success("Notification archived");
    } catch (error) {
      console.error("Failed to archive:", error);
      toast.error("Failed to archive notification");
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

  const getNotificationIcon = (type: string) => {
    const Icon = NOTIFICATION_ICONS[type] || Bell;
    return Icon;
  };

  const formatTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <Link href="/dashboard">
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              View and manage all your notifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 sm:h-9"
          >
            <RefreshCw
              className={cn("h-4 w-4 sm:mr-2", isLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-8 sm:h-9">
            <Link href="/dashboard/account/notification-settings">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="p-3 sm:p-6 pb-3">
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as FilterType)}
              className="w-full sm:w-auto"
            >
              <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
                <TabsTrigger
                  value="all"
                  className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">All</span>
                  {totalCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5"
                    >
                      {totalCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <BellOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Unread</span>
                  {unreadCount > 0 && (
                    <Badge
                      variant="default"
                      className="ml-0.5 sm:ml-1 text-[10px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="read"
                  className="gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Read</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {stores.length > 1 && (
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-35 sm:w-45 h-8 sm:h-9 text-xs sm:text-sm">
                    <Store className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

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
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg mb-1">No notifications</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {filter === "unread"
                  ? "You're all caught up! No unread notifications."
                  : filter === "read"
                    ? "No read notifications yet."
                    : "You don't have any notifications yet. They'll appear here when you receive them."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const colorClass =
                  NOTIFICATION_COLORS[notification.type] ||
                  "bg-muted-foreground";
                const isUnread = !notification.readAt;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 sm:gap-4 p-3 sm:p-4 transition-colors active:bg-muted/70",
                      isUnread && "bg-muted/50",
                      notification.actionUrl &&
                        "cursor-pointer hover:bg-muted/80"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon with type-specific color */}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={cn(
                                "text-[13px] sm:text-sm font-medium",
                                isUnread && "text-foreground",
                                !isUnread && "text-muted-foreground"
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
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-muted-foreground">
                            <span>{formatTime(notification.createdAt)}</span>
                            {notification.tenantName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 truncate">
                                  <Store className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {notification.tenantName}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 -mr-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isUnread && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Mark as read
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveNotification(notification.id);
                              }}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                    <Spinner className="mr-2 h-4 w-4" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {!isLoading && notifications.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {notifications.length} of {totalCount} notifications
        </p>
      )}
    </div>
  );
}
