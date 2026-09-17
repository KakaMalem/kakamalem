"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Banknote,
  Check,
  Info,
  Star,
  AlertTriangle,
  Coins,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { savePaymentGatewayConfig } from "@/lib/actions/payments";
import { updatePaymentCurrencySettings } from "@/lib/actions/stores";
import {
  currencyOptions,
  paymentCurrencySettingsSchema,
} from "@/lib/validations/stores";
import { CURRENCIES, getCurrencyMeta } from "@/lib/currency/currencies";
import {
  HESABPAY_CURRENCY,
  canStoreUseHesabPay,
  parseExchangeRate,
} from "@/lib/payments/currency";
/** Only what this form needs — never the credential columns on the row. */
type GatewaySettings = {
  isEnabled: boolean;
  displayOrder: number;
};

type GatewayType = "hesabpay" | "cod";

const PAYMENT_GATEWAYS: Array<{
  gateway: GatewayType;
  displayName: string;
  description: string;
  icon: typeof CreditCard;
  recommended: boolean;
  badge: string | null;
}> = [
  {
    gateway: "hesabpay",
    displayName: "Pay with Card (HesabPay)",
    description: "Accept card payments via HesabPay's secure hosted checkout.",
    icon: CreditCard,
    recommended: true,
    badge: "Online",
  },
  {
    gateway: "cod",
    displayName: "Cash on Delivery",
    description:
      "Customers pay when they receive their order. No online payment required.",
    icon: Banknote,
    recommended: false,
    badge: null,
  },
];

interface PaymentSettingsFormProps {
  storeId: string;
  storeCurrency: string;
  afnExchangeRate: string;
  initialConfigs: {
    hesabpay: GatewaySettings | null;
    cod: GatewaySettings | null;
  };
}

function getInitialDefault(
  configs: PaymentSettingsFormProps["initialConfigs"]
): GatewayType {
  const hesabPayOrder = configs.hesabpay?.displayOrder ?? 0;
  const codOrder = configs.cod?.displayOrder ?? 1;
  return hesabPayOrder <= codOrder ? "hesabpay" : "cod";
}

export function PaymentSettingsForm({
  storeId,
  storeCurrency,
  afnExchangeRate: initialAfnExchangeRate,
  initialConfigs,
}: PaymentSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currency, setCurrency] = useState(storeCurrency);
  const [afnExchangeRate, setAfnExchangeRate] = useState(
    initialAfnExchangeRate
  );
  const [rateError, setRateError] = useState<string | null>(null);

  const [enabledGateways, setEnabledGateways] = useState<
    Record<GatewayType, boolean>
  >({
    hesabpay: initialConfigs.hesabpay?.isEnabled ?? true,
    cod: initialConfigs.cod?.isEnabled ?? true,
  });

  const [defaultGateway, setDefaultGateway] = useState<GatewayType>(
    getInitialDefault(initialConfigs)
  );

  const [prevConfigs, setPrevConfigs] = useState(initialConfigs);
  if (
    prevConfigs.hesabpay?.isEnabled !== initialConfigs.hesabpay?.isEnabled ||
    prevConfigs.cod?.isEnabled !== initialConfigs.cod?.isEnabled ||
    prevConfigs.hesabpay?.displayOrder !==
      initialConfigs.hesabpay?.displayOrder ||
    prevConfigs.cod?.displayOrder !== initialConfigs.cod?.displayOrder
  ) {
    setPrevConfigs(initialConfigs);
    setEnabledGateways({
      hesabpay: initialConfigs.hesabpay?.isEnabled ?? true,
      cod: initialConfigs.cod?.isEnabled ?? true,
    });
    setDefaultGateway(getInitialDefault(initialConfigs));
  }

  // Re-sync currency fields when the server sends fresh values (after a save).
  const [prevCurrency, setPrevCurrency] = useState({
    storeCurrency,
    initialAfnExchangeRate,
  });
  if (
    prevCurrency.storeCurrency !== storeCurrency ||
    prevCurrency.initialAfnExchangeRate !== initialAfnExchangeRate
  ) {
    setPrevCurrency({ storeCurrency, initialAfnExchangeRate });
    setCurrency(storeCurrency);
    setAfnExchangeRate(initialAfnExchangeRate);
    setRateError(null);
  }

  const hasAnyEnabled = Object.values(enabledGateways).some(Boolean);

  const needsInitialSave =
    initialConfigs.hesabpay === null || initialConfigs.cod === null;

  const initialDefault = getInitialDefault(initialConfigs);

  // HesabPay settles in AFN only. A store priced in another currency without a
  // rate cannot offer it, and the storefront hides it at checkout.
  const needsAfnConversion = currency !== HESABPAY_CURRENCY;
  // An AFN store has no rate at all, so ignore anything left in the input after
  // switching currency back; otherwise a stale value would keep the form dirty
  // and keep failing validation on a field that is no longer even rendered.
  const effectiveRate = needsAfnConversion ? afnExchangeRate.trim() : "";
  const parsedRate = parseExchangeRate(effectiveRate);
  const hesabPayBlocked = !canStoreUseHesabPay(currency, effectiveRate);
  const afnMeta = getCurrencyMeta(HESABPAY_CURRENCY);

  const currencyChanged =
    currency !== storeCurrency ||
    effectiveRate !== initialAfnExchangeRate.trim();

  const hasChanges =
    needsInitialSave ||
    currencyChanged ||
    (initialConfigs.hesabpay?.isEnabled ?? true) !== enabledGateways.hesabpay ||
    (initialConfigs.cod?.isEnabled ?? true) !== enabledGateways.cod ||
    initialDefault !== defaultGateway;

  const handleToggle = (gateway: GatewayType, enabled: boolean) => {
    setEnabledGateways((prev) => ({
      ...prev,
      [gateway]: enabled,
    }));
  };

  const handleSave = () => {
    const parsed = paymentCurrencySettingsSchema.safeParse({
      currency,
      afnExchangeRate: effectiveRate,
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Invalid settings";
      setRateError(message);
      toast.error(message);
      return;
    }
    setRateError(null);

    startTransition(async () => {
      try {
        // Currency can be rejected outright (pending unpaid orders). If it is,
        // put the fields back to what the store actually has, so the rejected
        // edit stops blocking every later save, and carry on with the rest.
        let currencyRejected: string | null = null;

        if (currencyChanged) {
          const currencyResult = await updatePaymentCurrencySettings(storeId, {
            currency: parsed.data.currency,
            afnExchangeRate: parsed.data.afnExchangeRate,
          });

          if (currencyResult.error) {
            currencyRejected = currencyResult.error.message;
            setCurrency(storeCurrency);
            setAfnExchangeRate(initialAfnExchangeRate);
            setRateError(null);
          }
        }

        const results = await Promise.all(
          PAYMENT_GATEWAYS.map(async (gw, index) => {
            const displayOrder = gw.gateway === defaultGateway ? 0 : index + 1;

            const result = await savePaymentGatewayConfig(storeId, gw.gateway, {
              displayName: gw.displayName,
              description: gw.description,
              isEnabled: enabledGateways[gw.gateway],
              displayOrder,
            });
            return { gateway: gw.gateway, ...result };
          })
        );

        const failed = results.find((r) => !r.success);
        if (failed) {
          toast.error(failed.error || "Failed to save payment methods", {
            description:
              currencyChanged && !currencyRejected
                ? "Your currency settings were saved."
                : undefined,
          });
          // The currency may already be persisted, so pull server truth back in
          // rather than leaving the form claiming it is still unsaved.
          router.refresh();
          return;
        }

        if (currencyRejected) {
          toast.error(currencyRejected, {
            description:
              "Your currency was left unchanged. Other payment settings were saved.",
          });
        } else {
          toast.success("Payment settings updated");
        }
        router.refresh();
      } catch {
        toast.error("Failed to save payment settings");
      }
    });
  };

  const enabledGatewayList = PAYMENT_GATEWAYS.filter(
    (gw) => enabledGateways[gw.gateway]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Set the currency you price in and choose which payment methods
          customers can use at checkout.
        </p>
      </div>

      {!hasAnyEnabled && (
        <Alert variant="destructive">
          <Info className="size-4" />
          <AlertDescription>
            You must enable at least one payment method for customers to
            checkout.
          </AlertDescription>
        </Alert>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Currency                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4" />
            Store Currency
          </CardTitle>
          <CardDescription>
            The currency all your prices are shown in, across your storefront,
            dashboard, and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              value={currency}
              onValueChange={setCurrency}
              disabled={isPending}
            >
              <SelectTrigger id="currency" className="w-full sm:w-72">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((code) => {
                  const meta = CURRENCIES[code];
                  return (
                    <SelectItem key={code} value={code}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-6 text-muted-foreground">
                          {meta.symbol}
                        </span>
                        <span>
                          {meta.label}{" "}
                          <span className="text-muted-foreground">
                            ({code})
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {currency !== storeCurrency && (
            <Alert>
              <Info className="size-4" />
              <AlertDescription>
                Changing the currency only changes the symbol shown. It does not
                convert your existing product prices. Review your prices after
                switching.
              </AlertDescription>
            </Alert>
          )}

          {needsAfnConversion && (
            <div className="space-y-2">
              <Label htmlFor="afnExchangeRate">Afghani exchange rate</Label>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  1 {currency} =
                </span>
                <Input
                  id="afnExchangeRate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="w-40"
                  value={afnExchangeRate}
                  onChange={(e) => {
                    setAfnExchangeRate(e.target.value);
                    setRateError(null);
                  }}
                  placeholder="70"
                  disabled={isPending}
                  aria-invalid={!!rateError}
                />
                <span className="text-sm text-muted-foreground">
                  {HESABPAY_CURRENCY}
                </span>
              </div>
              {rateError ? (
                <p className="text-sm text-destructive">{rateError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  HesabPay can only charge customers in Afghani, so orders
                  priced in {currency} are converted at this rate. Leave it
                  empty to accept cash on delivery only.
                </p>
              )}
              {parsedRate && (
                <p className="text-sm text-muted-foreground">
                  A {getCurrencyMeta(currency).symbol}100 order is charged as{" "}
                  {afnMeta.symbol}
                  {Math.round(100 * parsedRate).toLocaleString("en-US")}.
                </p>
              )}
              {parsedRate && (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>
                    HesabPay converts that Afghani amount back to the
                    customer&apos;s card currency at its own rate, which is
                    usually weaker than the market rate. If customers are billed
                    more than your listed price, lower this rate until the
                    amount HesabPay shows matches. A market rate keeps your
                    Afghani revenue whole instead, at the cost of a slightly
                    higher card charge. Customers are told the final amount may
                    differ either way.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Payment methods                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {PAYMENT_GATEWAYS.map((gw) => {
            const Icon = gw.icon;
            const isEnabled = enabledGateways[gw.gateway];
            const isUnavailable = gw.gateway === "hesabpay" && hesabPayBlocked;

            return (
              <div
                key={gw.gateway}
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 transition-colors",
                  isEnabled && !isUnavailable
                    ? "border-primary/50 bg-primary/5"
                    : "bg-muted/30"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    isEnabled && !isUnavailable
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{gw.displayName}</h3>
                    {gw.recommended && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Recommended
                      </span>
                    )}
                    {gw.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {gw.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {gw.description}
                  </p>
                  {gw.gateway === "hesabpay" &&
                    needsAfnConversion &&
                    !isUnavailable && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Customers are charged in Afghani at 1 {currency} ={" "}
                        {afnMeta.symbol}
                        {parsedRate?.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                        .
                      </p>
                    )}
                  {isUnavailable && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-700">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Hidden at checkout until you set an Afghani exchange
                        rate above.
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isEnabled && !isUnavailable && (
                    <Check className="size-4 text-green-600" />
                  )}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      handleToggle(gw.gateway, checked)
                    }
                    disabled={isPending}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {hasAnyEnabled && enabledGatewayList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4" />
              Default Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              The default payment method will be pre-selected at checkout.
            </p>
            <RadioGroup
              value={defaultGateway}
              onValueChange={(value) => setDefaultGateway(value as GatewayType)}
              disabled={isPending}
            >
              {enabledGatewayList.map((gw) => {
                const Icon = gw.icon;
                return (
                  <Label
                    key={gw.gateway}
                    htmlFor={`default-${gw.gateway}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                      defaultGateway === gw.gateway
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem
                      value={gw.gateway}
                      id={`default-${gw.gateway}`}
                    />
                    <Icon className="size-4" />
                    <span className="font-medium">{gw.displayName}</span>
                    {gw.badge && (
                      <Badge variant="outline" className="text-xs">
                        {gw.badge}
                      </Badge>
                    )}
                    {defaultGateway === gw.gateway && (
                      <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        Default
                      </span>
                    )}
                  </Label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong>HesabPay:</strong> Customers are redirected to
                HesabPay&apos;s secure hosted checkout to complete payment.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong>Cash on Delivery:</strong> Customers pay when they
                receive their order. You collect payment directly.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span>
                <strong>Currency:</strong> HesabPay settles in Afghani. If you
                price in another currency, the total is converted at your rate
                and the customer sees the Afghani amount before paying.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending || !hasChanges || !hasAnyEnabled}
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
