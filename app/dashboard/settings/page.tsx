import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic information about your store.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            General settings form will be implemented here. This includes store
            name, description, contact email, phone number, and business
            address.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Store URL</CardTitle>
          <CardDescription>Your store&apos;s public address.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <span className="text-sm text-muted-foreground">
              kakamalem.com/store/
            </span>
            <span className="text-sm font-medium">your-store-slug</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            The currency used for your store prices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">AFN</span>
            <span className="text-sm text-muted-foreground">
              Afghan Afghani
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
