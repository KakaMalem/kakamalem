"use client";

import { useState, useTransition } from "react";
import {
  Globe,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  RefreshCw,
  Trash2,
  Shield,
  X,
  Loader2,
  Crown,
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
import { UpgradeButton } from "@/components/dashboard/billing/upgrade-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  connectDomain,
  verifyDomain,
  disconnectDomain,
} from "@/lib/actions/domains";
import { validateDomain } from "@/lib/validations/domains";
import {
  getDomainStatusDisplay,
  getSslStatusLabel,
  type DomainConfig,
  type DnsInstructions,
  type DomainStatus,
  type SslStatus,
} from "@/lib/types/domains";

interface DomainSettingsProps {
  storeSlug: string;
  isPro: boolean;
  domainConfig: DomainConfig | null;
  dnsInstructions: DnsInstructions | null;
}

export function DomainSettings({
  storeSlug,
  isPro,
  domainConfig: initialConfig,
  dnsInstructions: initialInstructions,
}: DomainSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [domainInput, setDomainInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(
    initialConfig
  );
  const [dnsInstructions, setDnsInstructions] =
    useState<DnsInstructions | null>(initialInstructions);

  const defaultDomain = `kakamalem.com/store/${storeSlug}`;
  const hasCustomDomain = !!domainConfig?.customDomain;
  const status = (domainConfig?.customDomainStatus ||
    "pending") as DomainStatus;
  const sslStatus = (domainConfig?.sslStatus || "pending") as SslStatus;
  const statusDisplay = getDomainStatusDisplay(status, sslStatus);

  // Handle domain input validation
  const handleDomainChange = (value: string) => {
    setDomainInput(value);
    if (value.trim()) {
      const result = validateDomain(value);
      setInputError(result.valid ? null : result.error || null);
    } else {
      setInputError(null);
    }
  };

  // Connect a new domain
  const handleConnectDomain = () => {
    const validation = validateDomain(domainInput);
    if (!validation.valid) {
      setInputError(validation.error || "Invalid domain");
      return;
    }

    startTransition(async () => {
      const result = await connectDomain(storeSlug, domainInput);

      if (result.success && result.dnsInstructions) {
        setDnsInstructions(result.dnsInstructions);
        setDomainConfig({
          customDomain: domainInput.toLowerCase().trim(),
          customDomainStatus: "pending",
          domainVerificationToken: result.dnsInstructions.verificationToken,
          domainVerifiedAt: null,
          sslStatus: "pending",
          sslProvisionedAt: null,
          cloudflareHostnameId: null,
          domainDnsRecords: null,
          domainError: null,
          domainLastCheckedAt: new Date().toISOString(),
        });
        setDomainInput("");
        toast.success("Domain added! Configure DNS records to complete setup.");
      } else {
        toast.error(result.error?.message || "Failed to connect domain");
      }
    });
  };

  // Verify DNS configuration
  const handleVerifyDomain = () => {
    startTransition(async () => {
      const result = await verifyDomain(storeSlug);

      if (result.success) {
        setDomainConfig((prev) =>
          prev
            ? {
                ...prev,
                customDomainStatus: result.status || prev.customDomainStatus,
                sslStatus: result.sslStatus || prev.sslStatus,
                domainLastCheckedAt: new Date().toISOString(),
              }
            : prev
        );

        if (result.status === "active") {
          toast.success(
            "Domain verified and active! SSL is handled automatically."
          );
        } else {
          toast.info(
            "DNS records not yet verified. Please check your DNS configuration."
          );
        }
      } else {
        toast.error(result.error?.message || "Verification failed");
      }
    });
  };

  // Disconnect domain
  const handleDisconnectDomain = () => {
    startTransition(async () => {
      const result = await disconnectDomain(storeSlug);

      if (result.success) {
        setDomainConfig(null);
        setDnsInstructions(null);
        toast.success("Domain disconnected");
      } else {
        toast.error(result.error?.message || "Failed to disconnect domain");
      }
    });
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/store/${storeSlug}`;
              window.open(url, "_blank", "");
            }}
          >
            <ExternalLink className="mr-2 size-4" />
            Visit Store
          </Button>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Domain</CardTitle>
              <CardDescription>
                Use your own domain name for a professional presence.
              </CardDescription>
            </div>
            {hasCustomDomain && (
              <Badge
                variant={
                  statusDisplay.color === "green"
                    ? "default"
                    : statusDisplay.color === "yellow"
                      ? "secondary"
                      : "destructive"
                }
                className="gap-1"
              >
                {statusDisplay.icon === "check" && (
                  <CheckCircle2 className="size-3" />
                )}
                {statusDisplay.icon === "clock" && <Clock className="size-3" />}
                {statusDisplay.icon === "alert" && (
                  <AlertCircle className="size-3" />
                )}
                {statusDisplay.icon === "x" && <X className="size-3" />}
                {statusDisplay.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCustomDomain ? (
            <>
              {/* Connected Domain Status */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                <Globe className="size-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{domainConfig.customDomain}</p>
                  <p className="text-sm text-muted-foreground">
                    {statusDisplay.description}
                  </p>
                </div>
                {status === "active" && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://${domainConfig.customDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Visit
                    </a>
                  </Button>
                )}
              </div>

              {/* SSL Status */}
              {status === "active" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="size-4 text-green-600" />
                  SSL Certificate: {getSslStatusLabel(sslStatus)}
                </div>
              )}

              {/* Error Message */}
              {domainConfig.domainError && status === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Configuration Error</AlertTitle>
                  <AlertDescription>
                    {domainConfig.domainError}
                  </AlertDescription>
                </Alert>
              )}

              {/* DNS Instructions */}
              {statusDisplay.showDnsInstructions && dnsInstructions && (
                <DnsInstructionsCard
                  instructions={dnsInstructions}
                  onCopy={copyToClipboard}
                />
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {statusDisplay.canRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyDomain}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}
                    Check DNS
                  </Button>
                )}
                {statusDisplay.canDisconnect && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 size-4" />
                        Disconnect Domain
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Domain?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove{" "}
                          <strong>{domainConfig.customDomain}</strong> from your
                          store. Your store will still be accessible at{" "}
                          <strong>{defaultDomain}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnectDomain}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {/* Last Checked */}
              {domainConfig.domainLastCheckedAt && (
                <p className="text-xs text-muted-foreground">
                  Last checked:{" "}
                  {new Date(domainConfig.domainLastCheckedAt).toLocaleString()}
                </p>
              )}
            </>
          ) : isPro ? (
            <>
              {/* Connect New Domain Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Domain Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="customDomain"
                      placeholder="mybrand.com"
                      value={domainInput}
                      onChange={(e) => handleDomainChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && domainInput && !inputError) {
                          handleConnectDomain();
                        }
                      }}
                    />
                    <Button
                      onClick={handleConnectDomain}
                      disabled={!domainInput || !!inputError || isPending}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                  {inputError && (
                    <p className="text-sm text-destructive">{inputError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    e.g. mybrand.com, www.mybrand.com, shop.mybrand.com
                  </p>
                </div>
              </div>

              {/* How It Works */}
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">How it works</h4>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">1.</span>
                    Enter your domain above.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">2.</span>
                    Add a CNAME record pointing to{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      proxy.kakamalem.com
                    </code>{" "}
                    and a TXT record for verification.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">3.</span>
                    SSL is provisioned automatically. Your store goes live.
                  </li>
                </ol>
              </div>
            </>
          ) : (
            <>
              {/* Pro Upgrade Prompt */}
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-amber-100">
                  <Crown className="size-6 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-medium">Pro Feature</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Custom domains are available on the Pro plan. Connect your
                    own domain like mybrand.com with free SSL.
                  </p>
                </div>
                <UpgradeButton storeSlug={storeSlug}>
                  <Crown className="mr-2 size-4" />
                  Upgrade to Pro
                </UpgradeButton>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// DNS Instructions Component
function DnsInstructionsCard({
  instructions,
  onCopy,
}: {
  instructions: DnsInstructions;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div>
        <h4 className="font-medium mb-2">Configure DNS Records</h4>
        <p className="text-sm text-muted-foreground">
          Log in to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
          and add the following DNS records for{" "}
          <strong>{instructions.domain}</strong>:
        </p>
      </div>

      {instructions.records.map((record, index) => (
        <div key={index} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{record.type}</Badge>
            <span className="text-sm font-medium">
              {record.purpose === "routing"
                ? "Route traffic to your store"
                : "Verify domain ownership"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {record.purpose === "routing"
              ? `Points your domain to our servers at ${instructions.proxyTarget}.`
              : "Proves you own this domain. Can be removed after verification."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Host / Name
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1 text-sm">
                  {record.name}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopy(record.name, "Name")}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {record.type === "TXT" ? "Value" : "Target / Value"}
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1 text-sm break-all">
                  {record.value}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onCopy(
                      record.value,
                      record.type === "TXT" ? "Value" : "Target"
                    )
                  }
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <Separator />

      {instructions.isApexDomain && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Apex Domain Note</AlertTitle>
          <AlertDescription>
            Some registrars don&apos;t support CNAME records on apex domains
            (e.g. mybrand.com without www). If your registrar doesn&apos;t allow
            it, use a subdomain like <strong>shop.{instructions.domain}</strong>{" "}
            or <strong>www.{instructions.domain}</strong> instead. Namecheap and
            Cloudflare support CNAME flattening for apex domains.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Clock className="size-4" />
        <AlertTitle>DNS Propagation</AlertTitle>
        <AlertDescription>
          DNS changes can take up to 48 hours to propagate, but usually complete
          within 5-30 minutes. Click &quot;Check DNS&quot; to verify your
          records once you&apos;ve added them.
        </AlertDescription>
      </Alert>
    </div>
  );
}
