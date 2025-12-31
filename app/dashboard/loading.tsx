export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="h-6 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </header>

      {/* Main content skeleton */}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Welcome section skeleton */}
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </div>

          {/* Stats cards skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg border bg-background p-6 space-y-3"
              >
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>

          {/* Recent orders skeleton */}
          <div className="space-y-4">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="rounded-lg border">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b p-4 last:border-b-0"
                >
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
