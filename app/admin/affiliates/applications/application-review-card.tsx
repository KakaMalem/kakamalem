"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Instagram,
  Youtube,
  Facebook,
  ExternalLink,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RelativeTime } from "@/components/ui/relative-time";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { adminReviewAffiliate } from "@/lib/actions/platform-affiliates";

interface ApplicationReviewCardProps {
  application: {
    id: string;
    displayName: string;
    slug: string;
    bio: string | null;
    websiteUrl: string | null;
    socialLinks: Record<string, string> | null;
    applicationNotes: string | null;
    appliedAt: Date | null;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
}

export function ApplicationReviewCard({
  application,
}: ApplicationReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    startTransition(async () => {
      const result = await adminReviewAffiliate({
        affiliateId: application.id,
        action: "approve",
      });

      if (!result.success) {
        toast.error(result.error?.message || "Failed to approve application");
        return;
      }

      toast.success(`${application.displayName} has been approved!`);
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await adminReviewAffiliate({
        affiliateId: application.id,
        action: "reject",
        reason: rejectReason || undefined,
      });

      if (!result.success) {
        toast.error(result.error?.message || "Failed to reject application");
        return;
      }

      toast.success("Application rejected");
      setShowRejectDialog(false);
      router.refresh();
    });
  };

  const socialIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="size-4" />,
    youtube: <Youtube className="size-4" />,
    facebook: <Facebook className="size-4" />,
    website: <Globe className="size-4" />,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{application.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              kakamalem.com/{application.slug}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            Applied <RelativeTime date={application.appliedAt} fallback="N/A" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Info */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm font-medium">{application.user?.name}</p>
          <p className="text-sm text-muted-foreground">
            {application.user?.email}
          </p>
        </div>

        {/* Bio */}
        {application.bio && (
          <div>
            <p className="text-sm font-medium mb-1">Bio</p>
            <p className="text-sm text-muted-foreground">{application.bio}</p>
          </div>
        )}

        {/* Website & Socials */}
        {(application.websiteUrl || application.socialLinks) && (
          <div>
            <p className="text-sm font-medium mb-2">Links</p>
            <div className="flex flex-wrap gap-2">
              {application.websiteUrl && (
                <a
                  href={application.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm hover:bg-muted/80"
                >
                  <Globe className="size-4" />
                  Website
                  <ExternalLink className="size-3" />
                </a>
              )}
              {application.socialLinks &&
                Object.entries(application.socialLinks).map(
                  ([platform, handle]) => {
                    if (!handle) return null;
                    return (
                      <span
                        key={platform}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm"
                      >
                        {socialIcons[platform] || <Globe className="size-4" />}
                        {handle}
                      </span>
                    );
                  }
                )}
            </div>
          </div>
        )}

        {/* Application Notes */}
        <div>
          <p className="text-sm font-medium mb-1">Promotion Strategy</p>
          <div className="rounded-lg border bg-background p-3 text-sm">
            {application.applicationNotes || "No notes provided"}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            Approve
          </Button>

          <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isPending} className="flex-1">
                <X className="mr-2 size-4" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Application</DialogTitle>
                <DialogDescription>
                  Are you sure you want to reject {application.displayName}
                  &apos;s application? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (optional, internal note)"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowRejectDialog(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <X className="mr-2 size-4" />
                  )}
                  Reject
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
