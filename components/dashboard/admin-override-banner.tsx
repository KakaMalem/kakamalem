import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

interface AdminOverrideBannerProps {
  storeName: string;
  storeId: string;
}

/**
 * Shown at the top of any store dashboard when a platform admin is acting on
 * a store they don't own or staff. Makes impersonation obvious so admins
 * don't accidentally make changes thinking they're in their own store.
 */
export function AdminOverrideBanner({
  storeName,
  storeId,
}: AdminOverrideBannerProps) {
  // Negative margins break out of the parent <main>'s p-4/md:p-6 padding so
  // the banner sits flush with the dashboard header above it.
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b border-amber-300 bg-amber-100 px-4 py-2 text-amber-900 shadow-sm md:-mx-6 md:-mt-6 md:mb-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 text-sm">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            <strong>Admin override:</strong> you&apos;re managing{" "}
            <strong>{storeName}</strong> as a platform admin. Changes affect the
            client&apos;s store.
          </span>
        </div>
        <Link
          href={`/admin/stores/${storeId}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-3" />
          Back to admin
        </Link>
      </div>
    </div>
  );
}
