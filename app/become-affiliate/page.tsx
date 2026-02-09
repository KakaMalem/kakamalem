import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/auth/server";
import { getCurrentUserAffiliateStatus } from "@/lib/actions/platform-affiliates";
import { Button } from "@/components/ui/button";
import { AffiliateApplicationForm } from "./affiliate-application-form";

export const metadata = {
  title: "Become an Affiliate | Kaka Malem",
  description:
    "Apply to join the Kaka Malem affiliate program and start earning commissions by referring new stores.",
};

export default async function BecomeAffiliatePage() {
  const user = await getUser();

  // If not logged in, redirect to login with return URL
  if (!user) {
    redirect("/login?returnTo=/become-affiliate");
  }

  // Check if user already has an affiliate account
  const statusResult = await getCurrentUserAffiliateStatus();

  if (statusResult.data?.hasApplied) {
    const status = statusResult.data.status;

    if (status === "approved") {
      return (
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
            <div className="landing-container-narrow flex items-center gap-4 py-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/affiliate">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold">Already an Affiliate</h1>
            </div>
          </header>

          <main className="landing-container-narrow py-12">
            <div className="rounded-xl border bg-green-50 p-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold">
                You&apos;re Already an Affiliate!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Your vanity URL is{" "}
                <span className="font-mono font-medium text-foreground">
                  kakamalem.com/{statusResult.data.slug}
                </span>
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild>
                  <Link href="/affiliate/dashboard">Go to Dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">Return to Homepage</Link>
                </Button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    if (status === "suspended") {
      return (
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
            <div className="landing-container-narrow flex items-center gap-4 py-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/affiliate">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold">Account Suspended</h1>
            </div>
          </header>

          <main className="landing-container-narrow py-12">
            <div className="rounded-xl border bg-red-50 p-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold">Account Suspended</h2>
              <p className="mt-2 text-muted-foreground">
                Your affiliate account has been suspended. Please contact
                support for more information.
              </p>
              <Button asChild className="mt-6">
                <Link href="/">Return to Homepage</Link>
              </Button>
            </div>
          </main>
        </div>
      );
    }

    // For rejected status, allow re-application - fall through to show the form
  }

  // Show application form for new applicants
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="landing-container-narrow flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/affiliate">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Become an Affiliate</h1>
        </div>
      </header>

      <main className="landing-container-narrow py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Join the Affiliate Program</h2>
          <p className="mt-2 text-muted-foreground">
            Fill out the form below to create your affiliate account.
            You&apos;ll get instant access to your personalized vanity URL and
            dashboard.
          </p>
        </div>

        <AffiliateApplicationForm userEmail={user.email} />
      </main>
    </div>
  );
}
