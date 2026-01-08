import Link from "next/link";
import { Rocket, Palette, Package, ClipboardList } from "lucide-react";
import { getUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Rocket,
    title: "Easy Store Setup",
    description:
      "Launch your online store in minutes. No coding or technical skills required.",
  },
  {
    icon: Palette,
    title: "Full Customization",
    description:
      "Make it yours with custom branding, colors, and layout options.",
  },
  {
    icon: Package,
    title: "Product Management",
    description:
      "Easily add, organize, and manage your entire product catalog.",
  },
  {
    icon: ClipboardList,
    title: "Order Tracking",
    description:
      "Keep track of every sale and manage orders from one dashboard.",
  },
];

const steps = [
  {
    number: "1",
    title: "Create your store",
    description: "Sign up and give your store a name",
  },
  {
    number: "2",
    title: "Add products",
    description: "Upload your products with photos and prices",
  },
  {
    number: "3",
    title: "Start selling",
    description: "Share your store link and accept orders",
  },
];

export default async function Home() {
  const user = await getUser();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            Kaka Malem
          </Link>
          <nav className="flex items-center gap-4">
            {user ? (
              <Button asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-6 py-16 md:py-24">
          <div className="mx-auto max-w-6xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Build your online store
              <br />
              <span className="text-muted-foreground">in minutes</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Create, customize, and manage your shop with ease. No coding
              required. Start selling today.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link href={user ? "/dashboard" : "/signup"}>
                  {user ? "Go to Dashboard" : "Start for Free"}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                asChild
              >
                <Link href="/store/kakamalem">View Demo Store</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/30 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to sell online
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Powerful features to help you launch and grow your business
              </p>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border bg-background p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-t px-6 py-16 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                How it works
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Get your store up and running in three simple steps
              </p>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t bg-muted/30 px-6 py-16 md:py-24">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to start selling?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Join thousands of sellers who have already built their stores with
              Kaka Malem.
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href={user ? "/dashboard" : "/signup"}>
                {user ? "Go to Dashboard" : "Create Your Store"}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Kaka Malem. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
