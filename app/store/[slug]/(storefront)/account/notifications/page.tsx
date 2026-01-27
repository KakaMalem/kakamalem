import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { CustomerNotificationsContent } from "./notifications-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getTenantBySlug(slug);

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

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const user = await getUser();
  if (!user) {
    redirect(
      `/store/${slug}/auth/login?redirect=/store/${slug}/account/notifications`
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
