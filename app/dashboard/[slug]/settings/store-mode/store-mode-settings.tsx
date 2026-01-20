"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Store,
  ShoppingBag,
  Phone,
  ImageIcon,
  Check,
  Printer,
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
  type StoreMode,
  type ReceiptPaperWidth,
} from "@/lib/validations/stores";

interface StoreModeSettingsProps {
  storeId: string;
  storeSlug: string;
  currentMode: string;
  onlineCheckoutEnabled: boolean;
  posEnabled: boolean;
  phoneOrdersEnabled: boolean;
  receiptPaperWidth: string;
  receiptShowLogo: boolean;
  receiptShowContact: boolean;
  receiptFooterText: string | null;
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
  onlineCheckoutEnabled: initialOnlineCheckout,
  posEnabled: initialPosEnabled,
  phoneOrdersEnabled: initialPhoneEnabled,
  receiptPaperWidth: initialPaperWidth,
  receiptShowLogo: initialShowLogo,
  receiptShowContact: initialShowContact,
  receiptFooterText: initialFooterText,
}: StoreModeSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state - Store Mode
  const [storeMode, setStoreMode] = useState<StoreMode>(
    currentMode as StoreMode
  );
  const [onlineCheckoutEnabled, setOnlineCheckoutEnabled] = useState(
    initialOnlineCheckout
  );
  const [posEnabled, setPosEnabled] = useState(initialPosEnabled);
  const [phoneOrdersEnabled, setPhoneOrdersEnabled] =
    useState(initialPhoneEnabled);

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

  // Track previous props to sync state when props change (e.g., after router.refresh())
  const [prevProps, setPrevProps] = useState({
    currentMode,
    initialOnlineCheckout,
    initialPosEnabled,
    initialPhoneEnabled,
    initialPaperWidth,
    initialShowLogo,
    initialShowContact,
    initialFooterText,
  });
  const propsChanged =
    prevProps.currentMode !== currentMode ||
    prevProps.initialOnlineCheckout !== initialOnlineCheckout ||
    prevProps.initialPosEnabled !== initialPosEnabled ||
    prevProps.initialPhoneEnabled !== initialPhoneEnabled ||
    prevProps.initialPaperWidth !== initialPaperWidth ||
    prevProps.initialShowLogo !== initialShowLogo ||
    prevProps.initialShowContact !== initialShowContact ||
    prevProps.initialFooterText !== initialFooterText;
  if (propsChanged) {
    setPrevProps({
      currentMode,
      initialOnlineCheckout,
      initialPosEnabled,
      initialPhoneEnabled,
      initialPaperWidth,
      initialShowLogo,
      initialShowContact,
      initialFooterText,
    });
    setStoreMode(currentMode as StoreMode);
    setOnlineCheckoutEnabled(initialOnlineCheckout);
    setPosEnabled(initialPosEnabled);
    setPhoneOrdersEnabled(initialPhoneEnabled);
    setReceiptPaperWidth(initialPaperWidth as ReceiptPaperWidth);
    setReceiptShowLogo(initialShowLogo);
    setReceiptShowContact(initialShowContact);
    setReceiptFooterText(initialFooterText || "");
  }

  // Track if form has changes
  const hasChanges =
    storeMode !== currentMode ||
    onlineCheckoutEnabled !== initialOnlineCheckout ||
    posEnabled !== initialPosEnabled ||
    phoneOrdersEnabled !== initialPhoneEnabled ||
    receiptPaperWidth !== initialPaperWidth ||
    receiptShowLogo !== initialShowLogo ||
    receiptShowContact !== initialShowContact ||
    receiptFooterText !== (initialFooterText || "");

  // Handle mode selection
  const handleModeSelect = (mode: StoreMode) => {
    setStoreMode(mode);

    // Apply mode presets
    switch (mode) {
      case "full":
        setOnlineCheckoutEnabled(true);
        setPosEnabled(true);
        setPhoneOrdersEnabled(true);
        break;
      case "online_only":
        setOnlineCheckoutEnabled(true);
        setPosEnabled(false);
        setPhoneOrdersEnabled(false);
        break;
      case "offline_only":
        setOnlineCheckoutEnabled(false);
        setPosEnabled(true);
        setPhoneOrdersEnabled(true);
        break;
      case "catalog":
        setOnlineCheckoutEnabled(false);
        setPosEnabled(false);
        setPhoneOrdersEnabled(false);
        break;
    }
  };

  // Handle save
  const handleSave = () => {
    startTransition(async () => {
      const result = await updateStoreModeSettings(storeId, storeSlug, {
        storeMode,
        onlineCheckoutEnabled,
        posEnabled,
        phoneOrdersEnabled,
        receiptPaperWidth,
        receiptShowLogo,
        receiptShowContact,
        receiptFooterText: receiptFooterText || undefined,
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

  // Check if channel toggles are disabled based on mode
  const isOnlineDisabled =
    storeMode === "offline_only" || storeMode === "catalog";
  const isPosDisabled = storeMode === "online_only" || storeMode === "catalog";
  const isPhoneDisabled =
    storeMode === "online_only" || storeMode === "catalog";

  // Show receipt settings only when POS is available
  const showReceiptSettings =
    storeMode === "offline_only" || (storeMode === "full" && posEnabled);

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
                  onClick={() => handleModeSelect(mode)}
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

      {/* Channel Toggles (for "full" mode customization) */}
      {storeMode === "full" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Fine-tune Sales Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              In Full Commerce mode, you can enable or disable specific sales
              channels. This gives you granular control over how customers can
              purchase from you.
            </p>

            <Separator />

            {/* Online Checkout Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Globe className="size-5" />
                </div>
                <div>
                  <Label htmlFor="online-checkout" className="font-medium">
                    Online Checkout
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Customers can purchase through your website
                  </p>
                </div>
              </div>
              <Switch
                id="online-checkout"
                checked={onlineCheckoutEnabled}
                onCheckedChange={setOnlineCheckoutEnabled}
                disabled={isOnlineDisabled}
              />
            </div>

            <Separator />

            {/* POS Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                  <Store className="size-5" />
                </div>
                <div>
                  <Label htmlFor="pos-enabled" className="font-medium">
                    In-Store Sales (POS)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Record in-person sales from your dashboard
                  </p>
                </div>
              </div>
              <Switch
                id="pos-enabled"
                checked={posEnabled}
                onCheckedChange={setPosEnabled}
                disabled={isPosDisabled}
              />
            </div>

            <Separator />

            {/* Phone Orders Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                  <Phone className="size-5" />
                </div>
                <div>
                  <Label htmlFor="phone-orders" className="font-medium">
                    Phone Orders
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Record orders taken over the phone
                  </p>
                </div>
              </div>
              <Switch
                id="phone-orders"
                checked={phoneOrdersEnabled}
                onCheckedChange={setPhoneOrdersEnabled}
                disabled={isPhoneDisabled}
              />
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
                      +93 700 000 000
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
                {onlineCheckoutEnabled && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-600" />
                    Customers can browse and checkout on your website
                  </li>
                )}
                {!onlineCheckoutEnabled && (
                  <li className="flex items-center gap-2 text-amber-600">
                    <span className="size-4 text-center">-</span>
                    Website checkout is disabled
                  </li>
                )}
                {posEnabled && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-600" />
                    &quot;Offline Sales&quot; appears in your dashboard for
                    in-store sales
                  </li>
                )}
                {!posEnabled && (
                  <li className="flex items-center gap-2 text-amber-600">
                    <span className="size-4 text-center">-</span>
                    In-store sales recording is hidden
                  </li>
                )}
                {phoneOrdersEnabled && (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-green-600" />
                    You can record phone orders in Offline Sales
                  </li>
                )}
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
