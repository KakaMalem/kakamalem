import { redirect } from "next/navigation";

interface OfflineSaleDetailPageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function OfflineSaleDetailPage({
  params,
}: OfflineSaleDetailPageProps) {
  const { slug, orderId } = await params;
  redirect(`/dashboard/${slug}/orders/${orderId}`);
}
