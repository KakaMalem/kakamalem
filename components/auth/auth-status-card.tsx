import { Card, CardContent } from "@/components/ui/card";
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
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
    ),
    error: (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-8 w-8 text-destructive" />
      </div>
    ),
    loading: <Spinner size="lg" className="mx-auto" />,
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-6 text-center">
          {icons[variant]}

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>

          {children}

          {(primaryAction || secondaryAction) && (
            <div className="flex flex-col gap-3">
              {primaryAction && (
                <>
                  {primaryAction.href ? (
                    <Button asChild className="w-full">
                      <Link href={primaryAction.href}>
                        {primaryAction.label}
                      </Link>
                    </Button>
                  ) : (
                    <Button onClick={primaryAction.onClick} className="w-full">
                      {primaryAction.label}
                    </Button>
                  )}
                </>
              )}
              {secondaryAction && (
                <Button variant="ghost" asChild>
                  <Link href={secondaryAction.href}>
                    {secondaryAction.label}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
