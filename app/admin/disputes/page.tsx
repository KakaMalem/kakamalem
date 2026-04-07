import { db } from "@/lib/db";
import { disputes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { DisputeResolveActions } from "./dispute-actions";

export const metadata = {
  title: "Disputes - Admin",
};

export default async function AdminDisputesPage() {
  const allDisputes = await db.query.disputes.findMany({
    with: {
      escrowTransaction: {
        with: {
          order: { columns: { id: true, orderNumber: true } },
          tenant: { columns: { id: true, name: true, slug: true } },
        },
      },
      openedByUser: { columns: { id: true, name: true, email: true } },
      resolvedByUser: { columns: { id: true, name: true } },
      messages: {
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      },
    },
    orderBy: [desc(disputes.createdAt)],
  });

  const openDisputes = allDisputes.filter((d) => d.status === "open");
  const resolvedDisputes = allDisputes.filter((d) => d.status !== "open");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="text-muted-foreground">
          Review and resolve buyer-seller disputes. Funds are frozen until you
          decide.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">
              {openDisputes.length}
            </p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {resolvedDisputes.length}
            </p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{allDisputes.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Open Disputes */}
      {openDisputes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="size-5 text-red-500" />
            Open Disputes ({openDisputes.length})
          </h2>
          {openDisputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}

      {openDisputes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No open disputes. All clear.
          </CardContent>
        </Card>
      )}

      {/* Resolved */}
      {resolvedDisputes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Resolved ({resolvedDisputes.length})
          </h2>
          {resolvedDisputes.map((dispute) => (
            <DisputeCard key={dispute.id} dispute={dispute} />
          ))}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DisputeCard({ dispute }: { dispute: Record<string, any> }) {
  const escrow = dispute.escrowTransaction;
  const order = escrow?.order;
  const store = escrow?.tenant;
  const opener = dispute.openedByUser;

  const statusColors: Record<string, string> = {
    open: "bg-red-100 text-red-800",
    resolved_buyer: "bg-blue-100 text-blue-800",
    resolved_seller: "bg-green-100 text-green-800",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{dispute.reason}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Opened by {opener?.name || opener?.email || "Unknown"} (
              {dispute.openedByRole}){" · "}
              {new Date(dispute.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge
            className={
              statusColors[dispute.status] || "bg-gray-100 text-gray-800"
            }
          >
            {dispute.status === "open"
              ? "Open"
              : dispute.status === "resolved_buyer"
                ? "Resolved — Buyer"
                : "Resolved — Seller"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Context */}
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Order</p>
            <p className="font-medium">
              {order ? (
                <Link
                  href={`/dashboard/${store?.slug}/orders/${order.id}`}
                  className="text-primary hover:underline"
                >
                  {order.orderNumber}
                </Link>
              ) : (
                "N/A"
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Store</p>
            <p className="font-medium">{store?.name || "Unknown"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Escrow Amount</p>
            <p className="font-medium">
              {escrow
                ? `${parseFloat(escrow.amount).toFixed(2)} ${escrow.currency.toUpperCase()}`
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Description */}
        {dispute.description && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground mb-1">Description</p>
            <p className="whitespace-pre-wrap">{dispute.description}</p>
          </div>
        )}

        {/* Messages */}
        {dispute.messages && dispute.messages.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Messages ({dispute.messages.length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {dispute.messages.map((msg: Record<string, string>) => (
                <div key={msg.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {msg.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolution note */}
        {dispute.resolutionNote && (
          <div className="rounded-lg border-green-200 bg-green-50 p-3 text-sm">
            <p className="text-green-800 font-medium mb-1">Resolution</p>
            <p className="text-green-700">{dispute.resolutionNote}</p>
            {dispute.resolvedByUser && (
              <p className="text-xs text-green-600 mt-1">
                by {dispute.resolvedByUser.name} on{" "}
                {dispute.resolvedAt
                  ? new Date(dispute.resolvedAt).toLocaleDateString()
                  : ""}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {dispute.status === "open" && (
          <DisputeResolveActions disputeId={dispute.id} />
        )}
      </CardContent>
    </Card>
  );
}
