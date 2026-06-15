import { MousePointerClick, Users, ShoppingBag, Banknote } from "lucide-react";

import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LinkStats } from "@/lib/db/queries/links";
import type { LinkRow } from "./types";

interface LinkStatsViewProps {
  link: LinkRow;
  stats: LinkStats;
  currency: string;
  days: number;
}

function buildSeries(
  clicksByDay: LinkStats["clicksByDay"],
  days: number
): { date: string; clicks: number }[] {
  const map = new Map(clicksByDay.map((d) => [d.date, d.clicks]));
  const out: { date: string; clicks: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, clicks: map.get(key) ?? 0 });
  }
  return out;
}

function hostFromReferrer(ref: string): string {
  if (ref === "Direct") return "Direct / app";
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return ref;
  }
}

export function LinkStatsView({
  link,
  stats,
  currency,
  days,
}: LinkStatsViewProps) {
  const series = buildSeries(stats.clicksByDay, days);
  const maxDay = Math.max(1, ...series.map((s) => s.clicks));
  const convRate =
    link.totalClicks > 0
      ? Math.round((link.totalConversions / link.totalClicks) * 100)
      : 0;

  const maxReferrer = Math.max(1, ...stats.topReferrers.map((r) => r.clicks));
  const totalDeviceClicks = Math.max(
    1,
    stats.devices.reduce((s, d) => s + d.clicks, 0)
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<MousePointerClick className="size-4" />}
          label="Total clicks"
          value={link.totalClicks.toLocaleString()}
        />
        <Kpi
          icon={<Users className="size-4" />}
          label="Unique visitors"
          value={link.uniqueClicks.toLocaleString()}
        />
        <Kpi
          icon={<ShoppingBag className="size-4" />}
          label="Orders"
          value={link.totalConversions.toLocaleString()}
          sub={`${convRate}% conversion`}
        />
        <Kpi
          icon={<Banknote className="size-4" />}
          label="Revenue"
          value={formatPrice(parseFloat(link.totalRevenue), currency)}
        />
      </div>

      {/* Clicks over time */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Clicks · last {days} days</h3>
        <div className="mt-4 flex h-32 items-end gap-0.5">
          {series.map((s) => (
            <div
              key={s.date}
              className="group relative flex-1"
              title={`${s.date}: ${s.clicks}`}
            >
              <div
                className={cn(
                  "w-full rounded-sm bg-primary/80 transition-colors group-hover:bg-primary",
                  s.clicks === 0 && "bg-muted"
                )}
                style={{
                  height: `${Math.max(2, (s.clicks / maxDay) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Referrers */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Top sources</h3>
          {stats.topReferrers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No clicks yet.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {stats.topReferrers.map((r) => (
                <div key={r.referrer}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">
                      {hostFromReferrer(r.referrer)}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.clicks}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(r.clicks / maxReferrer) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Devices + countries */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Devices</h3>
          {stats.devices.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No clicks yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.devices.map((d) => (
                <div
                  key={d.deviceType}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{d.deviceType}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round((d.clicks / totalDeviceClicks) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {stats.countries.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Top countries</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.countries.map((c) => (
                  <span
                    key={c.countryCode}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs"
                  >
                    <span className="font-medium">{c.countryCode}</span>
                    <span className="text-muted-foreground">{c.clicks}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent clicks */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Recent clicks</h3>
        {stats.recentClicks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No clicks yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Device</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Order</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentClicks.map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(c.clickedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2">
                      {[c.city, c.countryCode].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="py-2 capitalize">{c.deviceType || "—"}</td>
                    <td className="py-2 max-w-[12rem] truncate">
                      {c.referrer ? hostFromReferrer(c.referrer) : "Direct"}
                    </td>
                    <td className="py-2 text-right">
                      {c.isConverted ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
