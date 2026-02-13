"use client";

import { Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrencyStore } from "@/lib/stores/use-currency-store";
import {
  supportedCurrencies,
  currencyInfo,
  type SupportedCurrency,
} from "@/lib/currency/country-currency";
import { toast } from "sonner";

export function CurrencyPreferenceForm() {
  const { currencySource, setCurrencyPreference } = useCurrencyStore();

  const handleChange = (value: string) => {
    setCurrencyPreference(value as "auto" | SupportedCurrency);
    if (value === "auto") {
      toast.success("Currency set to auto-detect based on your location");
    } else {
      const info = currencyInfo[value as SupportedCurrency];
      toast.success(`Currency set to ${info?.name || value}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-5" />
          Currency
        </CardTitle>
        <CardDescription>
          Choose how prices are displayed. By default, your currency is
          automatically detected based on your location.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={currencySource} onValueChange={handleChange}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <span className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <span>System default</span>
                <span className="text-muted-foreground text-sm">
                  - Auto-detect
                </span>
              </span>
            </SelectItem>
            {supportedCurrencies.map((curr) => {
              const info = currencyInfo[curr];
              return (
                <SelectItem key={curr} value={curr}>
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center">{info.symbol}</span>
                    <span>{curr}</span>
                    <span className="text-muted-foreground text-sm">
                      - {info.name}
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
