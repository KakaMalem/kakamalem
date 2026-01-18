import { redirect } from "next/navigation";

interface ShippingPageProps {
  params: Promise<{ slug: string }>;
}

// Redirect to the unified Delivery & Shipping settings page
export default async function ShippingPage({ params }: ShippingPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/settings/delivery`);
}
