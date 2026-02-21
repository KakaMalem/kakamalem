import { redirect } from "next/navigation";

interface LayoutSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LayoutSettingsPage({
  params,
}: LayoutSettingsPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/customize`);
}
