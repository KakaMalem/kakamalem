import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold">
              Welcome, {user.user_metadata?.full_name || "there"}!
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage your store from here.
            </p>
          </div>

          {/* Quick stats placeholder */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-bold mt-2">0</p>
            </div>
            <div className="border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">Products</p>
              <p className="text-3xl font-bold mt-2">0</p>
            </div>
            <div className="border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-3xl font-bold mt-2">0 AFN</p>
            </div>
            <div className="border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">Payment Due</p>
              <p className="text-3xl font-bold mt-2">0 AFN</p>
            </div>
          </div>

          {/* Getting started */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs">
                  1
                </div>
                <span>Create your store</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs">
                  2
                </div>
                <span>Add your products</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs">
                  3
                </div>
                <span>Start selling</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
