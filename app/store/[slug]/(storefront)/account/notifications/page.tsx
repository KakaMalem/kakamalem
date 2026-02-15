import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { resolveTenant } from "@/lib/db/queries/tenants";
import { getStoreBasePath } from "@/lib/utils/store-path";
import { CustomerNotificationsContent } from "./notifications-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await resolveTenant(slug);

  return {
    title: store ? `Notifications - ${store.name}` : "Notifications",
    description: "View your order updates and notifications",
  };
}

export default async function CustomerNotificationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const store = await resolveTenant(slug);
  if (!store) {
    notFound();
  }

  const basePath = await getStoreBasePath(store.slug);

  const user = await getUser();
  if (!user) {
    redirect(
      `${basePath}/auth/login?redirect=${basePath}/account/notifications`
    );
  }

  return (
    <CustomerNotificationsContent
      tenantId={store.id}
      storeName={store.name}
      storeSlug={slug}
    />
  );
}
