import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { hasMinimumRole } from "@/lib/auth/context";
import { getPageLayout } from "@/lib/db/queries/page-layouts";
import { PageEditorClient } from "@/components/page-builder/page-editor-client";
import { defaultThemeConfig } from "@/lib/theme/presets";
import { defaultLayoutConfig } from "@/lib/theme/layout-types";
import type { ThemeConfig } from "@/lib/theme/types";
import type { LayoutConfig } from "@/lib/theme/layout-types";

interface PageEditorProps {
  params: Promise<{ slug: string; pageId: string }>;
}

export default async function PageEditorPage({ params }: PageEditorProps) {
  const { slug, pageId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const store = await getTenantBySlug(slug);
  if (!store) notFound();

  const canManage = await hasMinimumRole(store.id, "admin");
  if (!canManage) redirect(`/dashboard/${slug}`);

  const layout = await getPageLayout(store.id, pageId);
  if (!layout) notFound();

  const themeConfig =
    (store.themeConfig as ThemeConfig | null) ?? defaultThemeConfig;
  const layoutConfig =
    (store.layoutConfig as LayoutConfig | null) ?? defaultLayoutConfig;

  return (
    <PageEditorClient
      tenantId={store.id}
      storeSlug={store.slug}
      storeName={store.name}
      logoUrl={store.logoUrl || ""}
      currency={store.currency}
      pageId={layout.id}
      pageTitle={layout.title}
      pageSlug={layout.slug}
      isHomepage={layout.isHomepage}
      initialData={layout.draftData ?? layout.publishedData ?? null}
      hasPublished={!!layout.publishedData}
      initialThemeConfig={themeConfig}
      initialLayoutConfig={layoutConfig}
      subscriptionPlan={store.subscriptionPlan}
      customCss={store.customCss || ""}
    />
  );
}
