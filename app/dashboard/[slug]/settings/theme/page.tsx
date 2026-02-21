import { redirect } from "next/navigation";

interface ThemeSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ThemeSettingsPage({
  params,
}: ThemeSettingsPageProps) {
  const { slug } = await params;
  redirect(`/dashboard/${slug}/customize`);
}
