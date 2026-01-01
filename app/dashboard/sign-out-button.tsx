import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/auth/logout">Sign out</Link>
    </Button>
  );
}
