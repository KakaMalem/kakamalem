import { getPlatformSettings, getAdminAuditLogs } from "@/lib/db/queries/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import { Settings, History } from "lucide-react";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const [settings, auditLogs] = await Promise.all([
    getPlatformSettings(),
    getAdminAuditLogs(10),
  ]);

  const settingsLogs = auditLogs.filter((log) =>
    log.action.startsWith("settings.")
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure platform billing and subscription settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="size-5" />
                Billing Configuration
              </CardTitle>
              <CardDescription>
                These settings affect all stores on the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm settings={settings} />
            </CardContent>
          </Card>
        </div>

        {/* Recent Changes */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5" />
                Recent Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent settings changes
                </p>
              ) : (
                <div className="space-y-4">
                  {settingsLogs.map((log) => (
                    <div key={log.id} className="border-b pb-3 last:border-0">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        by {log.admin?.name || log.admin?.email || "Unknown"}
                      </p>
                      <RelativeTime
                        date={log.createdAt}
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
