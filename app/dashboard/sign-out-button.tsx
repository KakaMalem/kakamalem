import Link from "next/link";

export function SignOutButton() {
  return (
    <Link
      href="/auth/logout"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Sign out
    </Link>
  );
}
