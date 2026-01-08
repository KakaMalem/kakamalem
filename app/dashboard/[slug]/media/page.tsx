import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getMediaLibrary } from "@/lib/actions/media";
import { MediaLibrary } from "@/components/dashboard/media/media-library";

interface MediaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function MediaPage({
  params,
  searchParams,
}: MediaPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const page = parseInt(search.page || "1");
  const { items, pagination } = await getMediaLibrary(store.id, {
    search: search.search,
    page,
    limit: 24,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
        <p className="text-muted-foreground">
          Manage your store&apos;s images and media files.
        </p>
      </div>

      {/* Media Library */}
      <MediaLibrary
        tenantId={store.id}
        initialItems={items}
        initialPagination={pagination}
        initialSearch={search.search || ""}
      />
    </div>
  );
}
