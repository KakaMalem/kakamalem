"use client";

import { useState, useTransition } from "react";
import { Palette, Loader2, RotateCcw, Code2, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDesignContext } from "@/lib/page-builder/design-context";
import { updateThemeConfig, updateCustomCss } from "@/lib/actions/stores";
import { ColorsTab } from "./design-panel/colors-tab";
import { TypographyTab } from "./design-panel/typography-tab";

interface DesignPanelProps {
  storeId: string;
  storeSlug: string;
  isPro: boolean;
  initialCustomCss: string;
}

export function DesignPanel({
  storeId,
  storeSlug,
  isPro,
  initialCustomCss,
}: DesignPanelProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const { state, isDirty, resetToDefault } = useDesignContext();
  const [customCssValue, setCustomCssValue] = useState(initialCustomCss);
  const [cssOpen, setCssOpen] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      try {
        // Save theme
        const themeResult = await updateThemeConfig(storeId, state.theme);
        if (!themeResult.success) {
          toast.error(themeResult.error?.message || "Failed to save theme");
          return;
        }

        // Save custom CSS if Pro
        if (isPro && customCssValue !== initialCustomCss) {
          const cssResult = await updateCustomCss(
            storeId,
            storeSlug,
            customCssValue
          );
          if (!cssResult.success) {
            toast.error(
              cssResult.error?.message || "Failed to save custom CSS"
            );
            return;
          }
          if (cssResult.warnings && cssResult.warnings.length > 0) {
            toast.warning(
              `CSS saved with warnings: ${cssResult.warnings.join(", ")}`
            );
          }
        }

        toast.success("Design settings saved");
      } catch {
        toast.error("Failed to save design settings");
      }
    });
  };

  const handleReset = () => {
    if (
      !confirm(
        "Reset design settings to defaults? This will reset colors and fonts. You must save to apply."
      )
    ) {
      return;
    }
    resetToDefault();
    toast.info("Design reset to defaults — click Save to apply");
  };

  const cssIsDirty = customCssValue !== initialCustomCss;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title="Design settings"
        >
          <Palette className="size-4" />
        </button>
      </SheetTrigger>
      <SheetContent className="flex w-96 flex-col sm:w-[420px]">
        <SheetHeader>
          <SheetTitle>Design</SheetTitle>
        </SheetHeader>

        <Tabs
          defaultValue="colors"
          className="mt-2 flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="colors" className="text-xs">
              Colors
            </TabsTrigger>
            <TabsTrigger value="typography" className="text-xs">
              Style
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 py-4">
            <TabsContent value="colors" className="mt-0 px-4">
              <ColorsTab />
            </TabsContent>
            <TabsContent value="typography" className="mt-0 px-4">
              <TypographyTab />

              {/* Custom CSS — under Style tab */}
              <div className="mt-6 border-t pt-5">
                <Collapsible open={cssOpen} onOpenChange={setCssOpen}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted/50">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="size-3.5" />
                      Custom CSS
                    </span>
                    {!isPro && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Crown className="size-2.5" />
                        Pro
                      </span>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-2">
                    {isPro ? (
                      <>
                        <Textarea
                          value={customCssValue}
                          onChange={(e) => setCustomCssValue(e.target.value)}
                          placeholder=".my-store { /* custom styles */ }"
                          className="min-h-32 font-mono text-xs"
                          maxLength={10240}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          {customCssValue.length.toLocaleString()} / 10,240
                          characters
                        </p>
                      </>
                    ) : (
                      <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        Custom CSS is available on the Pro plan. Upgrade to add
                        custom styles to your store.
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || (!isDirty && !cssIsDirty)}
            className="ml-auto gap-1.5"
          >
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            Save Design
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
