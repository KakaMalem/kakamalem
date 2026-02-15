import { redirect, notFound } from "next/navigation";

import { resolveTenant } from "@/lib/db/queries/tenants";
import { getUser } from "@/lib/auth/server";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { AccountNav } from "@/components/store/account/account-nav";

interface AccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AccountLayout({
  children,
  params,
}: AccountLayoutProps) {
  const { slug } = await params;

  // Fetch store data
  const store = await resolveTenant(slug);

  if (!store) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  // Check authentication
  const user = await getUser();
  if (!user) {
    redirect(`${basePath}/auth/login?redirect=${basePath}/account`);
  }

  const baseUrl = `${basePath}/account`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="text-muted-foreground">
          Manage your account at {store.name}
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {/* Sidebar Navigation */}
        <AccountNav baseUrl={baseUrl} />

        {/* Main Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
