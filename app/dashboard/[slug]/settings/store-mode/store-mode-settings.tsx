"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Store,
  ShoppingBag,
  ImageIcon,
  Check,
  Printer,
  Camera,
  Usb,
  Ban,
  FileText,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { updateStoreModeSettings } from "@/lib/actions/stores";
import {
  storeModeOptions,
  storeModeLabels,
  storeModeDescriptions,
  receiptPaperWidthOptions,
  receiptPaperWidthLabels,
  receiptPaperWidthDescriptions,
  posScannerModeOptions,
  posScannerModeLabels,
  posScannerModeDescriptions,
  receiptPrintModeOptions,
  receiptPrintModeLabels,
  receiptPrintModeDescriptions,
  type StoreMode,
  type ReceiptPaperWidth,
  type PosScannerMode,
  type ReceiptPrintMode,
} from "@/lib/validations/stores";

interface StoreModeSettingsProps {
  storeId: string;
  storeSlug: string;
  currentMode: string;
  posScannerMode: string;
  receiptPaperWidth: string;
  receiptShowLogo: boolean;
  receiptShowContact: boolean;
  receiptFooterText: string | null;
  receiptPrintMode: string;
}

const MODE_ICONS: Record<StoreMode, typeof Globe> = {
  full: ShoppingBag,
  online_only: Globe,
  offline_only: Store,
  catalog: ImageIcon,
};

export function StoreModeSettings({
  storeId,
  storeSlug,
  currentMode,
  posScannerMode: initialScannerMode,
  receiptPaperWidth: initialPaperWidth,
  receiptShowLogo: initialShowLogo,
  receiptShowContact: initialShowContact,
  receiptFooterText: initialFooterText,
  receiptPrintMode: initialPrintMode,
}: StoreModeSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state - Store Mode
  const [storeMode, setStoreMode] = useState<StoreMode>(
    currentMode as StoreMode
  );
  const [posScannerMode, setPosScannerMode] = useState<PosScannerMode>(
    initialScannerMode as PosScannerMode
  );

  // Form state - Receipt Settings
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<ReceiptPaperWidth>(
    initialPaperWidth as ReceiptPaperWidth
  );
  const [receiptShowLogo, setReceiptShowLogo] = useState(initialShowLogo);
  const [receiptShowContact, setReceiptShowContact] =
    useState(initialShowContact);
  const [receiptFooterText, setReceiptFooterText] = useState(
    initialFooterText || ""
  );
  const [receiptPrintMode, setReceiptPrintMode] = useState<ReceiptPrintMode>(
    initialPrintMode as ReceiptPrintMode
  );

  // Track previous props to sync state when props change (e.g., after router.refresh())
  const [prevProps, setPrevProps] = useState({
    currentMode,
    initialScannerMode,
    initialPaperWidth,
    initialShowLogo,
    initialShowContact,
    initialFooterText,
    initialPrintMode,
  });
  const propsChanged =
    prevProps.currentMode !== currentMode ||
    prevProps.initialScannerMode !== initialScannerMode ||
    prevProps.initialPaperWidth !== initialPaperWidth ||
    prevProps.initialShowLogo !== initialShowLogo ||
    prevProps.initialShowContact !== initialShowContact ||
    prevProps.initialFooterText !== initialFooterText ||
    prevProps.initialPrintMode !== initialPrintMode;
  if (propsChanged) {
    setPrevProps({
      currentMode,
      initialScannerMode,
      initialPaperWidth,
      initialShowLogo,
      initialShowContact,
      initialFooterText,
      initialPrintMode,
    });
    setStoreMode(currentMode as StoreMode);
    setPosScannerMode(initialScannerMode as PosScannerMode);
    setReceiptPaperWidth(initialPaperWidth as ReceiptPaperWidth);
    setReceiptShowLogo(initialShowLogo);
    setReceiptShowContact(initialShowContact);
    setReceiptFooterText(initialFooterText || "");
    setReceiptPrintMode(initialPrintMode as ReceiptPrintMode);
  }

  // Track if form has changes
  const hasChanges =
    storeMode !== currentMode ||
    posScannerMode !== initialScannerMode ||
    receiptPaperWidth !== initialPaperWidth ||
    receiptShowLogo !== initialShowLogo ||
    receiptShowContact !== initialShowContact ||
    receiptFooterText !== (initialFooterText || "") ||
    receiptPrintMode !== initialPrintMode;

  // Derive channel settings from store mode
  const getChannelSettings = (mode: StoreMode) => {
    switch (mode) {
      case "full":
        return { onlineCheckoutEnabled: true, posEnabled: true };
      case "online_only":
        return { onlineCheckoutEnabled: true, posEnabled: false };
      case "offline_only":
        return { onlineCheckoutEnabled: false, posEnabled: true };
      case "catalog":
        return { onlineCheckoutEnabled: false, posEnabled: false };
    }
  };

  const channelSettings = getChannelSettings(storeMode);

  // Handle save
  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        storeMode,
        ...channelSettings,
        posScannerMode,
        receiptPaperWidth,
        receiptShowLogo,
        receiptShowContact,
        receiptFooterText: receiptFooterText || undefined,
        receiptPrintMode,
      });

      if (result.success) {
        toast.success("Settings updated successfully");
        // Refresh the page to get fresh server data and update all components
        router.refresh();
      } else {
        toast.error(result.error?.message || "Failed to update settings");
      }
    });
  };

  // Show receipt settings only when POS is available
  const showReceiptSettings =
    storeMode === "offline_only" || storeMode === "full";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Store Mode</h2>
        <p className="text-sm text-muted-foreground">
          Choose how your store operates. This affects which features are
          available to you and your customers.
        </p>
      </div>

      {/* Store Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How do you want to sell?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {storeModeOptions.map((mode) => {
              const Icon = MODE_ICONS[mode];
              const isSelected = storeMode === mode;

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStoreMode(mode)}
                  className={cn(
                    "relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3">
                      <Check className="size-5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-medium">{storeModeLabels[mode]}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {storeModeDescriptions[mode]}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* POS Scanner Settings */}
      {showReceiptSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="size-5" />
              Barcode Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to scan product barcodes in POS mode.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {posScannerModeOptions.map((mode) => {
                const isSelected = posScannerMode === mode;
                const Icon = mode === "camera" ? Camera : Usb;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPosScannerMode(mode)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2">
                        <Check className="size-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 pr-6">
                      <div className="font-medium text-sm">
                        {posScannerModeLabels[mode]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {posScannerModeDescriptions[mode]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Settings */}
      {showReceiptSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="size-5" />
              Receipt Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Customize how receipts look when printed from your dashboard.
            </p>

            {/* Paper Width Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Paper Size</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {receiptPaperWidthOptions.map((width) => {
                  const isSelected = receiptPaperWidth === width;
                  return (
                    <button
                      key={width}
                      type="button"
                      onClick={() => setReceiptPaperWidth(width)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2">
                          <Check className="size-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex h-10 items-center justify-center rounded border-2 border-dashed",
                          width === "80mm" ? "w-12" : "w-9",
                          isSelected
                            ? "border-primary/50 bg-primary/10"
                            : "border-muted-foreground/30"
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground">
                          {width === "80mm" ? "80" : "58"}
                        </span>
                      </div>
                      <div className="flex-1 pr-6">
                        <div className="font-medium text-sm">
                          {receiptPaperWidthLabels[width]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {receiptPaperWidthDescriptions[width]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Print Mode Selection */}
            <div className="space-y-3">
              <Label className="font-medium">Auto-Print After Checkout</Label>
              <p className="text-xs text-muted-foreground">
                Choose what happens after completing a POS sale.
              </p>
              <div className="grid gap-3">
                {receiptPrintModeOptions.map((mode) => {
                  const isSelected = receiptPrintMode === mode;
                  const Icon =
                    mode === "disabled"
                      ? Ban
                      : mode === "prompt"
                        ? FileText
                        : Printer;
                  const isSilentUnsupported =
                    mode === "silent" &&
                    typeof navigator !== "undefined" &&
                    !("serial" in navigator);

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        !isSilentUnsupported && setReceiptPrintMode(mode)
                      }
                      disabled={isSilentUnsupported}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isSilentUnsupported
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted/50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2">
                          <Check className="size-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 pr-6">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {receiptPrintModeLabels[mode]}
                          {isSilentUnsupported && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-normal">
                              <AlertTriangle className="size-3" />
                              Chrome/Edge only
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {receiptPrintModeDescriptions[mode]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Content Toggles */}
            <div className="space-y-4">
              <Label className="font-medium">Receipt Content</Label>

              {/* Show Logo */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Store Logo</p>
                  <p className="text-xs text-muted-foreground">
                    Show your logo at the top of receipts
                  </p>
                </div>
                <Switch
                  id="show-logo"
                  checked={receiptShowLogo}
                  onCheckedChange={setReceiptShowLogo}
                />
              </div>

              {/* Show Contact Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Contact Info</p>
                  <p className="text-xs text-muted-foreground">
                    Show phone number and email
                  </p>
                </div>
                <Switch
                  id="show-contact"
                  checked={receiptShowContact}
                  onCheckedChange={setReceiptShowContact}
                />
              </div>
            </div>

            <Separator />

            {/* Custom Footer Text */}
            <div className="space-y-2">
              <Label htmlFor="footer-text" className="font-medium">
                Footer Message
              </Label>
              <p className="text-xs text-muted-foreground">
                Custom message at the bottom of every receipt
              </p>
              <Textarea
                id="footer-text"
                value={receiptFooterText}
                onChange={(e) => setReceiptFooterText(e.target.value)}
                placeholder="Thank you for shopping with us!"
                maxLength={200}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {receiptFooterText.length}/200
              </p>
            </div>

            <Separator />

            {/* Mini Receipt Preview */}
            <div className="space-y-3">
              <Label className="font-medium">Preview</Label>
              <div className="flex justify-center">
                <div
                  className={cn(
                    "rounded border bg-white p-3 shadow-sm text-center",
                    receiptPaperWidth === "80mm" ? "w-48" : "w-36"
                  )}
                >
                  {receiptShowLogo && (
                    <div className="mx-auto mb-2 h-6 w-12 rounded bg-muted flex items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">
                        LOGO
                      </span>
                    </div>
                  )}
                  <p
                    className={cn(
                      "font-bold",
                      receiptPaperWidth === "80mm" ? "text-sm" : "text-xs"
                    )}
                  >
                    Your Store
                  </p>
                  {receiptShowContact && (
                    <p className="text-[10px] text-muted-foreground">
                      +1 234 567 8900
                    </p>
                  )}
                  <div className="my-2 border-t border-dashed" />
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>Receipt #</span>
                      <span>RCP-001</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date</span>
                      <span>Today</span>
                    </div>
                  </div>
                  <div className="my-2 border-t border-dashed" />
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>1x Item</span>
                      <span>500</span>
                    </div>
                  </div>
                  <div className="my-2 border-t border-dashed" />
                  <div className="flex justify-between text-[10px] font-bold">
                    <span>Total</span>
                    <span>500 AFN</span>
                  </div>
                  <div className="my-2 border-t border-dashed" />
                  <p className="text-[9px] text-muted-foreground mt-2">
                    {receiptFooterText || "Thank you for your purchase!"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What This Means */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What this means</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {storeMode === "full" && (
              <>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  Customers can browse and checkout on your website
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  &quot;Offline Sales&quot; appears in your dashboard for
                  in-store sales
                </li>
              </>
            )}
            {storeMode === "online_only" && (
              <>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  Customers can browse and checkout on your website
                </li>
                <li className="flex items-center gap-2 text-amber-600">
                  <span className="size-4 text-center">-</span>
                  &quot;Offline Sales&quot; is hidden from your dashboard
                </li>
              </>
            )}
            {storeMode === "offline_only" && (
              <>
                <li className="flex items-center gap-2 text-amber-600">
                  <span className="size-4 text-center">-</span>
                  Website checkout is disabled (customers see &quot;Contact for
                  purchase&quot;)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  &quot;Offline Sales&quot; appears in your dashboard for
                  in-store sales
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  Products still display on your website as a catalog
                </li>
              </>
            )}
            {storeMode === "catalog" && (
              <>
                <li className="flex items-center gap-2 text-amber-600">
                  <span className="size-4 text-center">-</span>
                  No checkout anywhere - customers must contact you to order
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  Products display on your website as a showcase/portfolio
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" />
                  Perfect for real estate, services, or quote-based businesses
                </li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
