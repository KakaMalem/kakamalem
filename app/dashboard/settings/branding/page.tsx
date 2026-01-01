import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BrandingSettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload your store logo. Recommended size: 512x512px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              Logo upload will be implemented here
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favicon</CardTitle>
          <CardDescription>
            The small icon shown in browser tabs. Recommended size: 32x32px.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              Favicon upload will be implemented here
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Header Display</CardTitle>
          <CardDescription>
            Choose how your store name appears in the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Options: Logo only, Text only, Logo + Text
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
