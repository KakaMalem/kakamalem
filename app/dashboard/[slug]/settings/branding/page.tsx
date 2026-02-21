import { redirect } from "next/navigation";

interface BrandingSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandingSettingsPage({
  params,
}: BrandingSettingsPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/customize`);
}
