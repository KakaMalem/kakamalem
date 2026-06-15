import Link from "next/link";
import { LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Link unavailable",
  robots: { index: false, follow: false },
};

export default function LinkUnavailablePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <LinkIcon className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          This link isn&apos;t available
        </h1>
        <p className="mt-3 text-muted-foreground">
          The link you followed may have expired, been turned off, or never
          existed. Double-check the address, or head to Kaka Malem.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go to Kaka Malem</Link>
        </Button>
      </div>
    </div>
  );
}
