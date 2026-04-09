import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BillingUpgradePage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/billing`);
}
