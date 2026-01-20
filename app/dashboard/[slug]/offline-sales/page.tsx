import { redirect } from "next/navigation";

interface OfflineSalesPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OfflineSalesPage({
  params,
}: OfflineSalesPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/orders?channel=offline`);
}
