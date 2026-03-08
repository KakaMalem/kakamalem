import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ShoppingBag, Package } from "lucide-react";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getTenantCategories } from "@/lib/db/queries/products";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AmazonImportClient } from "./amazon-import-client";
import { AliExpressImportClient } from "./aliexpress-import-client";

interface ImportPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ImportPage({
  params,
  searchParams,
}: ImportPageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const categories = await getTenantCategories(store.id);

  // Honour the ?tab= query param coming from the Import dropdown
  const activeTab =
    tab === "amazon" || tab === "aliexpress" ? tab : "aliexpress";

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/${slug}/products`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Import Products</h1>
          <p className="text-muted-foreground text-sm">
            Import product details, images, and variants from external
            marketplaces.
          </p>
        </div>
      </div>

      {/* Import Tabs — default tab honours ?tab= search param */}
      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="h-auto p-1.5 rounded-xl gap-1">
          <TabsTrigger
            value="aliexpress"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:shadow-sm"
          >
            <ShoppingBag className="h-4 w-4 text-orange-500" />
            <span className="font-medium">AliExpress</span>
          </TabsTrigger>
          <TabsTrigger
            value="amazon"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:shadow-sm"
          >
            <Package className="h-4 w-4 text-sky-500" />
            <span className="font-medium">Amazon</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aliexpress" className="mt-6">
          <AliExpressImportClient
            tenantId={store.id}
            storeSlug={slug}
            currency={store.currency}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>

        <TabsContent value="amazon" className="mt-6">
          <AmazonImportClient
            tenantId={store.id}
            storeSlug={slug}
            currency={store.currency}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
