"use client";

import {
  Globe,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DomainSettingsProps {
  storeSlug: string;
  storeName: string;
}

export function DomainSettings({ storeSlug, storeName }: DomainSettingsProps) {
  const defaultDomain = `kakamalem.com/store/${storeSlug}`;

  return (
    <div className="space-y-6">
      {/* Current Domain */}
      <Card>
        <CardHeader>
          <CardTitle>Your Store URL</CardTitle>
          <CardDescription>
            This is where customers can find your store online.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
            <Globe className="size-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">{defaultDomain}</p>
              <p className="text-sm text-muted-foreground">
                Free subdomain included with your store
              </p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3" />
              Active
            </Badge>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/store/${storeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 size-4" />
              Visit Store
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Custom Domain - Coming Soon */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Use your own domain name for a professional presence.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" />
              Coming Soon
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Feature in Development</AlertTitle>
            <AlertDescription>
              Custom domain support is coming soon. You&apos;ll be able to
              connect your own domain (e.g., www.
              {storeName.toLowerCase().replace(/\s+/g, "")}.com) to your store.
            </AlertDescription>
          </Alert>

          <Separator />

          <div className="space-y-4 opacity-60">
            <div className="space-y-2">
              <Label htmlFor="customDomain">Domain Name</Label>
              <Input
                id="customDomain"
                placeholder="www.yourdomain.com"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain you want to connect to your store.
              </p>
            </div>

            <Button disabled>Connect Domain</Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Will Work */}
      <Card>
        <CardHeader>
          <CardTitle>How Custom Domains Will Work</CardTitle>
          <CardDescription>
            A preview of the setup process once this feature is available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                1
              </div>
              <div>
                <h4 className="font-medium">Add your domain</h4>
                <p className="text-sm text-muted-foreground">
                  Enter the domain name you want to use for your store.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                2
              </div>
              <div>
                <h4 className="font-medium">Configure DNS records</h4>
                <p className="text-sm text-muted-foreground">
                  Add the required CNAME or A records at your domain registrar
                  (GoDaddy, Namecheap, Cloudflare, etc.).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                3
              </div>
              <div>
                <h4 className="font-medium">SSL certificate provisioning</h4>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll automatically provision a free SSL certificate for
                  your domain to ensure secure connections.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                4
              </div>
              <div>
                <h4 className="font-medium">Go live!</h4>
                <p className="text-sm text-muted-foreground">
                  Once verified, your store will be accessible at your custom
                  domain. The default subdomain will still work.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Benefits of a Custom Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong className="text-foreground">
                  Professional branding
                </strong>{" "}
                - Build trust with a domain that matches your business name.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong className="text-foreground">Better SEO</strong> - Custom
                domains can improve your search engine rankings.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong className="text-foreground">Memorable URL</strong> -
                Easier for customers to remember and share.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong className="text-foreground">Brand ownership</strong> -
                Your domain, your identity, even if you switch platforms.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
