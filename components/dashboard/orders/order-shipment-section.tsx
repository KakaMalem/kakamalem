"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Truck,
  MapPin,
  ChevronDown,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { safeFormat } from "@/lib/utils/safe-date";
import type {
  ShipmentRecord,
  ShipmentTrackingEventRecord,
} from "@/lib/db/queries/orders";
import type { ShipmentStatus } from "@/lib/db/schema";

interface OrderShipmentSectionProps {
  shipments: ShipmentRecord[];
}

const STATUS_CONFIG: Record<
  ShipmentStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: Clock,
  },
  picked_up: {
    label: "Picked Up",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Package,
  },
  in_transit: {
    label: "In Transit",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: Truck,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: MapPin,
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertCircle,
  },
  returned: {
    label: "Returned",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: RotateCcw,
  },
};

function formatDate(dateString: string) {
  return safeFormat(dateString, "MMM d, yyyy");
}

function formatDateTime(dateString: string) {
  return safeFormat(dateString, "MMM d, h:mm a");
}

function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.color)}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function TrackingTimeline({
  events,
}: {
  events: ShipmentTrackingEventRecord[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No tracking updates yet
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const config = STATUS_CONFIG[event.status];
        const Icon = config.icon;
        const isFirst = index === 0;
        const isLast = index === events.length - 1;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-3"
          >
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center size-6 rounded-full border",
                  isFirst
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-3" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 min-h-6 bg-muted-foreground/20" />
              )}
            </div>

            {/* Event content */}
            <div className={cn("pb-4", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  isFirst ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {config.label}
              </p>
              {event.description && (
                <p className="text-sm text-muted-foreground">
                  {event.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>{formatDateTime(event.eventTime)}</span>
                {event.location && (
                  <>
                    <span>-</span>
                    <span>{event.location}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: ShipmentRecord }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Shipment header */}
      <div className="p-4 bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShipmentStatusBadge status={shipment.status} />
              {shipment.carrierName && (
                <span className="text-sm text-muted-foreground">
                  via {shipment.carrierName}
                </span>
              )}
            </div>

            {shipment.trackingNumber && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">
                  {shipment.trackingNumber}
                </span>
                {shipment.trackingUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    asChild
                  >
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3 mr-1" />
                      Track
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="text-right text-sm text-muted-foreground">
            {shipment.shippedAt && (
              <p>Shipped: {formatDate(shipment.shippedAt)}</p>
            )}
            {shipment.deliveredAt && (
              <p>Delivered: {formatDate(shipment.deliveredAt)}</p>
            )}
          </div>
        </div>

        {/* Shipment items */}
        {shipment.items.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Items in this shipment:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shipment.items.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center text-xs bg-background px-2 py-1 rounded border"
                >
                  {item.productName}
                  {item.variantName && (
                    <span className="text-muted-foreground ml-1">
                      ({item.variantName})
                    </span>
                  )}
                  <span className="text-muted-foreground ml-1">
                    x{item.quantity}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tracking events collapsible */}
      {shipment.trackingEvents.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
              <span>
                {shipment.trackingEvents.length} tracking update
                {shipment.trackingEvents.length !== 1 ? "s" : ""}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pb-4"
                >
                  <TrackingTimeline events={shipment.trackingEvents} />
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function OrderShipmentSection({ shipments }: OrderShipmentSectionProps) {
  if (shipments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="size-5" />
          Shipments
          <Badge variant="secondary" className="ml-auto">
            {shipments.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {shipments.map((shipment) => (
          <ShipmentCard key={shipment.id} shipment={shipment} />
        ))}
      </CardContent>
    </Card>
  );
}
