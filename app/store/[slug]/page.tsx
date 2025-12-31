interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold">Store: {slug}</h1>
      <p className="mt-2 text-muted-foreground">This store is coming soon.</p>
    </div>
  );
}
