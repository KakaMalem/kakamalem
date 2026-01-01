import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number; // percentage change
  icon?: React.ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  change,
  icon,
  className,
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const showChange = change !== undefined && change !== 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {showChange && (
            <span
              className={cn(
                "flex items-center font-medium",
                isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {isPositive ? (
                <TrendingUp className="mr-0.5 size-3" />
              ) : (
                <TrendingDown className="mr-0.5 size-3" />
              )}
              {isPositive ? "+" : ""}
              {change}%
            </span>
          )}
          {subtitle && <span>{showChange ? `· ${subtitle}` : subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
