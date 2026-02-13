import { redirect } from "next/navigation";
import { QrCode, Share2, Download } from "lucide-react";

import { getUser } from "@/lib/auth/server";
import { getPlatformAffiliateByUserId } from "@/lib/db/queries/platform-affiliates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/affiliate/copy-link-button";

export const metadata = {
  title: "My Link | Affiliate Dashboard",
};

export default async function AffiliateLinkPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/affiliate/dashboard/link");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate || affiliate.status !== "approved") {
    redirect("/become-affiliate");
  }

  const affiliateLink = `https://kakamalem.com/${affiliate.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Affiliate Link</h1>
        <p className="text-muted-foreground">
          Share your unique link to earn commissions on referred subscriptions.
        </p>
      </div>

      {/* Main Link Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Unique Link</CardTitle>
          <CardDescription>
            Anyone who signs up through this link will be tracked as your
            referral
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm break-all">
              {affiliateLink}
            </div>
            <CopyLinkButton link={affiliateLink} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-4">
            <Button variant="outline" className="w-full">
              <QrCode className="mr-2 size-4" />
              Generate QR Code
            </Button>
            <Button variant="outline" className="w-full">
              <Share2 className="mr-2 size-4" />
              Share on Social
            </Button>
            <Button variant="outline" className="w-full">
              <Download className="mr-2 size-4" />
              Download Banner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Referral Tracking Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-1">Share Your Link</h3>
              <p className="text-sm text-muted-foreground">
                Share your unique affiliate link with potential store owners
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-1">They Sign Up</h3>
              <p className="text-sm text-muted-foreground">
                When they create a store through your link, they&apos;re tracked
                as your referral (90-day cookie)
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-1">Earn Commissions</h3>
              <p className="text-sm text-muted-foreground">
                Earn commissions on their subscription payments for 12 months
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Tips for Success</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                Share your link on social media platforms where business owners
                hang out
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                Create content explaining the benefits of using Kaka Malem for
                their business
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                Reach out to local businesses who might benefit from an online
                store
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Include your affiliate link in your email signature</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
