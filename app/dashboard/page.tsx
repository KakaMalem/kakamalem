import { getUser } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.user_metadata?.full_name || "there"}!
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your store.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No orders yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No products yet</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 AFN</div>
            <p className="text-xs text-muted-foreground">Total sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 AFN</div>
            <p className="text-xs text-muted-foreground">Free tier active</p>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-sm font-medium text-muted-foreground">
                1
              </div>
              <div>
                <p className="font-medium">Create your store</p>
                <p className="text-sm text-muted-foreground">
                  Set up your store name, branding, and settings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-sm font-medium text-muted-foreground">
                2
              </div>
              <div>
                <p className="font-medium">Add your products</p>
                <p className="text-sm text-muted-foreground">
                  Upload products with images, prices, and descriptions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-sm font-medium text-muted-foreground">
                3
              </div>
              <div>
                <p className="font-medium">Start selling</p>
                <p className="text-sm text-muted-foreground">
                  Share your store link and receive orders
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
