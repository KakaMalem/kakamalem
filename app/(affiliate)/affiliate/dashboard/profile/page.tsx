import { redirect } from "next/navigation";
import { User, Link2, Share2 } from "lucide-react";

import { getUser } from "@/lib/auth/server";
import { getPlatformAffiliateByUserId } from "@/lib/db/queries/platform-affiliates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";

export const metadata = {
  title: "Profile | Affiliate Dashboard",
};

export default async function AffiliateProfilePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login?redirect=/affiliate/dashboard/profile");
  }

  const affiliate = await getPlatformAffiliateByUserId(user.id);

  if (!affiliate || affiliate.status !== "approved") {
    redirect("/become-affiliate");
  }

  const socialLinks = affiliate.socialLinks as Record<string, string> | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your affiliate profile and public information.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Account Information
          </CardTitle>
          <CardDescription>
            Your basic affiliate account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <Badge
                className={
                  affiliate.status === "approved"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {affiliate.status.charAt(0).toUpperCase() +
                  affiliate.status.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Current Tier
              </p>
              <Badge
                className={
                  affiliate.currentTier === "gold"
                    ? "bg-yellow-100 text-yellow-800"
                    : affiliate.currentTier === "silver"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-amber-100 text-amber-800"
                }
              >
                {affiliate.currentTier.charAt(0).toUpperCase() +
                  affiliate.currentTier.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Commission Rate
              </p>
              <p className="font-medium">{affiliate.currentCommissionRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Public Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            Public Profile
          </CardTitle>
          <CardDescription>
            This information is shown on your affiliate landing page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <Field>
              <FieldLabel>Display Name</FieldLabel>
              <Input
                defaultValue={affiliate.displayName}
                placeholder="Your name or brand"
              />
              <FieldDescription>
                This is the name shown on your public affiliate page
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Vanity URL</FieldLabel>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  kakamalem.com/
                </span>
                <Input
                  defaultValue={affiliate.slug}
                  className="max-w-xs"
                  disabled
                />
              </div>
              <FieldDescription>
                Your vanity URL cannot be changed after creation
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Bio</FieldLabel>
              <Textarea
                defaultValue={affiliate.bio || ""}
                placeholder="Tell visitors about yourself..."
                rows={4}
              />
              <FieldDescription>
                A short description shown on your affiliate page
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Website</FieldLabel>
              <Input
                type="url"
                defaultValue={affiliate.websiteUrl || ""}
                placeholder="https://yourwebsite.com"
              />
            </Field>

            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            Social Links
          </CardTitle>
          <CardDescription>
            Add your social media profiles (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Instagram</FieldLabel>
                <Input
                  defaultValue={socialLinks?.instagram || ""}
                  placeholder="@username"
                />
              </Field>
              <Field>
                <FieldLabel>YouTube</FieldLabel>
                <Input
                  defaultValue={socialLinks?.youtube || ""}
                  placeholder="Channel name or URL"
                />
              </Field>
              <Field>
                <FieldLabel>TikTok</FieldLabel>
                <Input
                  defaultValue={socialLinks?.tiktok || ""}
                  placeholder="@username"
                />
              </Field>
              <Field>
                <FieldLabel>Facebook</FieldLabel>
                <Input
                  defaultValue={socialLinks?.facebook || ""}
                  placeholder="Page name or URL"
                />
              </Field>
            </div>
            <Button type="submit">Save Social Links</Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your affiliate account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Deactivate Account</p>
              <p className="text-sm text-muted-foreground">
                Temporarily disable your affiliate account. You can reactivate
                it later.
              </p>
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Deactivate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
