import { Suspense } from "react";
import Link from "next/link";
import { getUser } from "@/lib/auth/server";
import { MarketplaceNavbar } from "@/components/marketplace/marketplace-navbar";

export default async function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense>
        <MarketplaceNavbar user={user} />
      </Suspense>
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Link href="/" className="text-xl font-bold">
                Kaka Malem
              </Link>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Discover stores and products from merchants across Afghanistan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Marketplace</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/marketplace"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Browse All
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Start Selling
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Company</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/terms"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Kaka Malem. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
