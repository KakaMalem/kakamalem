"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { updatePlatformSettings } from "@/lib/actions/admin";
import { Loader2, Save } from "lucide-react";

interface SettingsFormProps {
  settings: {
    id: string | null;
    proPlanPriceAfn: string;
    proPlanYearlyPriceAfn: string;
    freeProductLimit: number;
    trialDurationDays: number;
    transactionFeePercent: string;
    trialWarningDays: number;
  };
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    proPlanPriceAfn: settings.proPlanPriceAfn,
    proPlanYearlyPriceAfn: settings.proPlanYearlyPriceAfn,
    freeProductLimit: settings.freeProductLimit,
    trialDurationDays: settings.trialDurationDays,
    transactionFeePercent: settings.transactionFeePercent,
    trialWarningDays: settings.trialWarningDays,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updatePlatformSettings({
        proPlanPriceAfn: formData.proPlanPriceAfn,
        proPlanYearlyPriceAfn: formData.proPlanYearlyPriceAfn,
        freeProductLimit: formData.freeProductLimit,
        trialDurationDays: formData.trialDurationDays,
        transactionFeePercent: formData.transactionFeePercent,
        trialWarningDays: formData.trialWarningDays,
      });

      if (result.success) {
        toast.success(result.message || "Settings saved");
      } else {
        toast.error(result.error);
      }
    });
  };

  const hasChanges =
    formData.proPlanPriceAfn !== settings.proPlanPriceAfn ||
    formData.proPlanYearlyPriceAfn !== settings.proPlanYearlyPriceAfn ||
    formData.freeProductLimit !== settings.freeProductLimit ||
    formData.trialDurationDays !== settings.trialDurationDays ||
    formData.transactionFeePercent !== settings.transactionFeePercent ||
    formData.trialWarningDays !== settings.trialWarningDays;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Subscription Pricing</h3>
        <p className="text-sm text-muted-foreground">
          Configure pricing for the Pro plan (paid via HesabPay)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="proPlanPriceAfn">Pro Plan Price (AFN/month)</Label>
          <Input
            id="proPlanPriceAfn"
            type="number"
            min="0"
            step="1"
            value={formData.proPlanPriceAfn}
            onChange={(e) =>
              setFormData({ ...formData, proPlanPriceAfn: e.target.value })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Monthly subscription price for Pro plan
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proPlanYearlyPriceAfn">
            Pro Plan Price (AFN/year)
          </Label>
          <Input
            id="proPlanYearlyPriceAfn"
            type="number"
            min="0"
            step="1"
            value={formData.proPlanYearlyPriceAfn}
            onChange={(e) =>
              setFormData({
                ...formData,
                proPlanYearlyPriceAfn: e.target.value,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Yearly subscription price (set lower than 12x monthly for discount)
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transactionFeePercent">
            Transaction Fee (%) - Future Use
          </Label>
          <Input
            id="transactionFeePercent"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.transactionFeePercent}
            onChange={(e) =>
              setFormData({
                ...formData,
                transactionFeePercent: e.target.value,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Currently disabled (set to 0)
          </p>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Free Tier Limits</h3>
        <p className="text-sm text-muted-foreground">
          Restrictions for free plan stores
        </p>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label htmlFor="freeProductLimit">Max Products (Free)</Label>
        <Input
          id="freeProductLimit"
          type="number"
          min="1"
          max="1000"
          value={formData.freeProductLimit}
          onChange={(e) =>
            setFormData({
              ...formData,
              freeProductLimit: parseInt(e.target.value) || 20,
            })
          }
          onWheel={(e) => e.currentTarget.blur()}
        />
        <p className="text-xs text-muted-foreground">
          Maximum products on free plan
        </p>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium">Trial Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure free trial behavior
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="trialDurationDays">Trial Duration (days)</Label>
          <Input
            id="trialDurationDays"
            type="number"
            min="1"
            max="90"
            value={formData.trialDurationDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                trialDurationDays: parseInt(e.target.value) || 7,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            How long new stores get free trial
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="trialWarningDays">Warning Before Expiry (days)</Label>
          <Input
            id="trialWarningDays"
            type="number"
            min="1"
            max="30"
            value={formData.trialWarningDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                trialWarningDays: parseInt(e.target.value) || 3,
              })
            }
            onWheel={(e) => e.currentTarget.blur()}
          />
          <p className="text-xs text-muted-foreground">
            Days before trial ends to show in dashboard
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !hasChanges}>
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
