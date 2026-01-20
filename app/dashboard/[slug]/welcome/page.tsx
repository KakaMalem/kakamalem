import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/auth/server";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { WelcomeContent } from "./welcome-content";

interface WelcomePageProps {
  params: Promise<{ slug: string }>;
}

export default async function WelcomePage({ params }: WelcomePageProps) {
  const { slug } = await params;
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const store = await getTenantBySlug(slug);

  if (!store) {
    notFound();
  }

  return <WelcomeContent store={store} />;
}
