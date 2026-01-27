import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, ArrowLeft } from "lucide-react";

interface AccessDeniedProps {
  /** Custom title (default: "Access Denied") */
  title?: string;
  /** Custom message explaining why access was denied */
  message?: string;
  /** URL for the back button (default: "/dashboard") */
  backUrl?: string;
  /** Label for the back button (default: "Back to Dashboard") */
  backLabel?: string;
  /** Show as full-screen centered (default: false, fits within parent) */
  fullScreen?: boolean;
}

/**
 * Access Denied component for displaying 403-style errors
 *
 * Use this when a user doesn't have permission to access a resource
 * instead of returning notFound() which shows a 404.
 *
 * @example
 * ```tsx
 * // In a settings page that requires owner role
 * if (!userContext || userContext.role !== "owner") {
 *   return (
 *     <AccessDenied
 *       message="Only the store owner can access this page."
 *       backUrl={`/dashboard/${slug}/settings`}
 *       backLabel="Back to Settings"
 *     />
 *   );
 * }
 * ```
 */
export function AccessDenied({
  title = "Access Denied",
  message = "You don't have permission to access this page. Please contact your store owner if you need access.",
  backUrl = "/dashboard",
  backLabel = "Back to Dashboard",
  fullScreen = false,
}: AccessDeniedProps) {
  const containerClasses = fullScreen
    ? "flex min-h-screen flex-col items-center justify-center px-6"
    : "flex min-h-[60vh] flex-col items-center justify-center px-6";

  const cardClasses = fullScreen
    ? "w-full max-w-md"
    : "w-full max-w-md border-0 shadow-none bg-transparent";

  return (
    <div className={containerClasses}>
      <Card className={cardClasses}>
        <CardContent className="pt-6 space-y-6">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600">
            <ShieldX className="h-8 w-8" />
          </div>

          {/* Message */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href={backUrl}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
