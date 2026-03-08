"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Key,
  Copy,
  RotateCcw,
  Trash2,
  ExternalLink,
  Globe,
} from "lucide-react";
import {
  generateExternalApiKeyAction,
  revokeExternalApiKeyAction,
} from "@/lib/actions/integrations";
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

interface IntegrationsFormProps {
  tenantId: string;
  tenantSlug: string;
  initialApiKey: string | null;
}

export function IntegrationsForm({
  tenantId,
  tenantSlug: _tenantSlug,
  initialApiKey,
}: IntegrationsFormProps) {
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);
  const [isGenerating, setIsGenerating] = useState(false);
  const [_isRevoking, setIsRevoking] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // The base URL for the Sales Channel API (custom store)
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")}/api/v1/integrations/autods/${tenantId}`;

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await generateExternalApiKeyAction(tenantId);
    if (result.success && result.key) {
      setApiKey(result.key);
      setShowKey(true);
      toast.success("API Key generated successfully");
    } else {
      toast.error(result.error || "Failed to generate API key");
    }
    setIsGenerating(false);
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    const result = await revokeExternalApiKeyAction(tenantId);
    if (result.success) {
      setApiKey(null);
      setShowKey(false);
      toast.success("API Key revoked");
    } else {
      toast.error(result.error || "Failed to revoke API key");
    }
    setIsRevoking(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* AutoDS / Custom Sales Channel API Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Globe className="size-5" />
              </div>
              <div>
                <CardTitle>Sales Channel API</CardTitle>
                <CardDescription>
                  Connect your store to <strong>AutoDS</strong> or other
                  dropshipping automation tools.
                </CardDescription>
              </div>
            </div>
            <Badge variant={apiKey ? "default" : "secondary"}>
              {apiKey ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                API Endpoint URL
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={apiUrl}
                  readOnly
                  className="bg-muted font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(apiUrl, "API URL")}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Provide this URL in your AutoDS &quot;Custom Store&quot;
                settings.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                API Key (Sales Channel Key)
              </Label>
              {apiKey ? (
                <div className="flex items-center gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowKey(!showKey)}
                  >
                    <Key className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(apiKey, "API Key")}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-4">
                    No active API key. Generate one to start connecting.
                  </p>
                  <Button onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? "Generating..." : "Generate API Key"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-3 border border-orange-100 dark:border-orange-900/30">
            <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-400 mb-1">
              Setup Instructions for AutoDS
            </h4>
            <ol className="text-xs text-orange-700 dark:text-orange-300 space-y-1 ml-4 list-decimal">
              <li>Log in to your AutoDS dashboard.</li>
              <li>
                Go to &quot;Add Store&quot; and select &quot;Custom Store&quot;.
              </li>
              <li>Paste the API Endpoint URL above.</li>
              <li>Provide the API Key generated on this page.</li>
              <li>AutoDS will now be able to sync prices and pull orders.</li>
            </ol>
          </div>
        </CardContent>
        {apiKey && (
          <CardFooter className="flex justify-between border-t border-muted bg-muted/10">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <RotateCcw className="size-3.5 mr-2" />
                Rotate Key
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Revoke Key
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately disconnect your store from AutoDS and
                    any other services using this API key. Automation will stop
                    working.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRevoke}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Revoke Key
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a
            href="https://autods.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit AutoDS <ExternalLink className="size-3.5 ml-2" />
          </a>
        </Button>
      </div>
    </div>
  );
}
