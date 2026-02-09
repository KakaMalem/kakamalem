import Link from "next/link";
import { getPlatformAffiliatesForAdmin } from "@/lib/db/queries/platform-affiliates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { ApplicationReviewCard } from "./application-review-card";

// =============================================================================
// ADMIN AFFILIATE APPLICATIONS
// =============================================================================

interface ApplicationsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const {
    items: applications,
    total,
    page: currentPage,
    totalPages,
  } = await getPlatformAffiliatesForAdmin({
    page,
    limit: 10,
    status: "pending",
    sortBy: "appliedAt",
    sortOrder: "asc", // Oldest first (FIFO)
  });

  const pagination = { total, page: currentPage, totalPages };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/affiliates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pending Applications
          </h1>
          <p className="text-muted-foreground">
            Review and approve affiliate applications
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No pending applications</h3>
            <p className="text-muted-foreground text-center mt-1">
              All affiliate applications have been reviewed.
            </p>
            <Link href="/admin/affiliates" className="mt-4">
              <Button variant="outline">View All Affiliates</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pagination.total} application{pagination.total !== 1 ? "s" : ""}{" "}
            pending review
          </p>

          {/* Application Cards */}
          <div className="space-y-4">
            {applications.map((application) => (
              <ApplicationReviewCard
                key={application.id}
                application={{
                  id: application.id,
                  displayName: application.displayName,
                  slug: application.slug,
                  bio: application.bio,
                  websiteUrl: application.websiteUrl,
                  socialLinks: application.socialLinks as Record<
                    string,
                    string
                  > | null,
                  applicationNotes: application.applicationNotes,
                  appliedAt: application.appliedAt
                    ? new Date(application.appliedAt)
                    : null,
                  user: application.user,
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex justify-center gap-2">
                <Link
                  href={`/admin/affiliates/applications?page=${pagination.page - 1}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Previous
                  </Button>
                </Link>
                <Link
                  href={`/admin/affiliates/applications?page=${pagination.page + 1}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
