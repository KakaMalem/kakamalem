import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

type StatusVariant = "success" | "error" | "loading";

interface AuthStatusCardProps {
  variant: StatusVariant;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  children?: ReactNode;
}

export function AuthStatusCard({
  variant,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
}: AuthStatusCardProps) {
  const icons = {
    success: (
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
    ),
    error: (
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
        <XCircle className="h-6 w-6 text-red-600" />
      </div>
    ),
    loading: <Spinner size="lg" className="mx-auto" />,
  };

  return (
    <div className="space-y-6 text-center">
      {icons[variant]}

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {children}

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col gap-3">
          {primaryAction && (
            <>
              {primaryAction.href ? (
                <Button asChild className="w-full">
                  <Link href={primaryAction.href}>{primaryAction.label}</Link>
                </Button>
              ) : (
                <Button onClick={primaryAction.onClick} className="w-full">
                  {primaryAction.label}
                </Button>
              )}
            </>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
