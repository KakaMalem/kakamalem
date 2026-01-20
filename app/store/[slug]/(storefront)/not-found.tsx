import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PackageX } from "lucide-react";

export default function StoreNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
      <Card className="w-full max-w-sm border-0 shadow-none bg-transparent">
        <CardContent className="pt-6 space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PackageX className="h-8 w-8 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Item Not Found</h1>
            <p className="text-muted-foreground">
              The product or page you are looking for doesn&apos;t exist or has
              been removed.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="./">Continue Shopping</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="./products">Browse All Products</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
