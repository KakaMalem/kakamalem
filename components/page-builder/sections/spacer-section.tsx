import { cn } from "@/lib/utils";
import type { SpacerProps } from "@/lib/page-builder/types";

const heightClasses: Record<SpacerProps["height"], string> = {
  xs: "h-4",
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
};

export function SpacerSection({ height = "md" }: SpacerProps) {
  return <div className={cn(heightClasses[height])} aria-hidden="true" />;
}
