"use client";

import { Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CustomerNotificationSettingsProps {
  tenantId: string;
  storeName: string;
}

export function CustomerNotificationSettings({
  storeName,
}: CustomerNotificationSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Stay updated on your orders from {storeName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border bg-muted/30 p-3">
          <Bell className="h-4 w-4 shrink-0" />
          <span>
            You&apos;ll receive notifications about order confirmations,
            shipping updates, and deliveries through the notification bell in
            your account.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
