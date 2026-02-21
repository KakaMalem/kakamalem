"use client";

import { Search, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorContext } from "@/lib/page-builder/editor-context";
import { Logo } from "@/components/ui/logo";
import type { HeaderConfig } from "@/lib/theme/layout-types";
import { defaultHeaderConfig } from "@/lib/theme/layout-types";

const colorSchemeClasses: Record<
  HeaderConfig["colorScheme"],
  { bg: string; text: string }
> = {
  light: { bg: "bg-background", text: "text-foreground" },
  dark: { bg: "bg-gray-900", text: "text-white" },
  primary: { bg: "bg-primary", text: "text-primary-foreground" },
  transparent: { bg: "bg-transparent", text: "text-foreground" },
  custom: { bg: "", text: "" },
};

const paddingClasses: Record<HeaderConfig["padding"], string> = {
  compact: "py-2",
  normal: "py-3",
  spacious: "py-5",
};

const logoSizeMap: Record<HeaderConfig["logoSize"], "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

/**
 * Puck render component for the StoreHeader section.
 * Reads ALL settings from Puck props (config object).
 */
export function StoreHeaderPreview({
  config: _config,
}: {
  config?: HeaderConfig;
}) {
  const config = { ...defaultHeaderConfig, ..._config };
  const { storeName, logoUrl: editorLogoUrl } = useEditorContext();

  const logoUrl = config.logoUrl || editorLogoUrl;
  const hasLogo = Boolean(logoUrl);
  const showLogo =
    hasLogo &&
    (config.headerDisplay === "logo_only" ||
      config.headerDisplay === "logo_and_name");
  const showName =
    config.headerDisplay === "name_only" ||
    config.headerDisplay === "logo_and_name" ||
    (config.headerDisplay === "logo_only" && !hasLogo);

  const scheme =
    colorSchemeClasses[config.colorScheme] ?? colorSchemeClasses.light;
  const customStyle =
    config.colorScheme === "custom"
      ? {
          backgroundColor: config.backgroundColor || undefined,
          color: config.textColor || undefined,
        }
      : undefined;

  return (
    <div>
      {/* Sticky indicator */}
      {config.stickyHeader && (
        <div className="flex items-center justify-center bg-muted/50 py-0.5 text-[10px] text-muted-foreground">
          Sticky Header
        </div>
      )}

      {/* Header */}
      <header
        className={cn(
          "w-full",
          scheme.bg,
          scheme.text,
          config.borderBottom && "border-b",
          paddingClasses[config.padding]
        )}
        style={customStyle}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {config.headerStyle === "centered" ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-center py-2">
                <LogoBlock
                  showLogo={showLogo}
                  showName={showName}
                  logoUrl={logoUrl}
                  storeName={storeName}
                  logoSize={config.logoSize}
                />
              </div>
              {/* Nav items in centered mode */}
              {config.navItems.length > 0 && (
                <div className="flex items-center justify-center gap-4 border-t py-2">
                  {config.navItems.map((item, i) => (
                    <span
                      key={i}
                      className="text-sm font-medium opacity-70 hover:opacity-100"
                    >
                      {item.label || "Link"}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 border-t py-2">
                {config.showSearchBar ? (
                  <div className="flex flex-1 justify-center">
                    <SearchBarPreview />
                  </div>
                ) : (
                  <div className="flex-1" />
                )}
                <ActionIcons />
              </div>
            </div>
          ) : config.headerStyle === "minimal" ? (
            <div className="flex items-center gap-2">
              <LogoBlock
                showLogo={showLogo}
                showName={showName}
                logoUrl={logoUrl}
                storeName={storeName}
                logoSize={config.logoSize}
                size="sm"
              />
              {/* Nav items in minimal mode */}
              {config.navItems.length > 0 && (
                <div className="ml-4 hidden items-center gap-3 sm:flex">
                  {config.navItems.map((item, i) => (
                    <span
                      key={i}
                      className="text-sm opacity-70 hover:opacity-100"
                    >
                      {item.label || "Link"}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex-1" />
              {config.showSearchBar && (
                <div className="max-w-xs flex-1">
                  <SearchBarPreview small />
                </div>
              )}
              <ActionIcons />
            </div>
          ) : (
            /* Default */
            <div className="flex items-center gap-3 lg:gap-6">
              <LogoBlock
                showLogo={showLogo}
                showName={showName}
                logoUrl={logoUrl}
                storeName={storeName}
                logoSize={config.logoSize}
              />
              {/* Nav items in default mode */}
              {config.navItems.length > 0 && (
                <div className="hidden items-center gap-4 sm:flex">
                  {config.navItems.map((item, i) => (
                    <span
                      key={i}
                      className="text-sm font-medium opacity-70 hover:opacity-100"
                    >
                      {item.label || "Link"}
                    </span>
                  ))}
                </div>
              )}
              {config.showSearchBar ? (
                <div className="flex flex-1 justify-center">
                  <SearchBarPreview />
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <ActionIcons />
            </div>
          )}
        </div>
      </header>

      {/* Categories bar preview */}
      {config.showCategoriesBar && (
        <nav
          className={cn("border-b", scheme.bg, scheme.text)}
          style={customStyle}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 py-2.5">
              {["All", "Category 1", "Category 2", "Category 3"].map(
                (cat, i) => (
                  <span
                    key={cat}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium",
                      i === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/80 text-secondary-foreground"
                    )}
                  >
                    {cat}
                  </span>
                )
              )}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

function LogoBlock({
  showLogo,
  showName,
  logoUrl,
  storeName,
  logoSize = "md",
  size = "default",
}: {
  showLogo: boolean;
  showName: boolean;
  logoUrl: string;
  storeName: string;
  logoSize?: HeaderConfig["logoSize"];
  size?: "sm" | "default";
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {showLogo && (
        <Logo logoUrl={logoUrl} alt={storeName} size={logoSizeMap[logoSize]} />
      )}
      {showName && (
        <span
          className={cn(
            "font-semibold tracking-tight",
            size === "sm" ? "text-sm" : "text-lg"
          )}
        >
          {storeName}
        </span>
      )}
    </div>
  );
}

function SearchBarPreview({ small }: { small?: boolean }) {
  return (
    <div
      className={cn(
        "relative w-full",
        small ? "max-w-xs" : "max-w-md lg:max-w-lg"
      )}
    >
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <div
        className={cn(
          "w-full rounded-md border bg-transparent pl-10 pr-4 text-sm text-muted-foreground",
          small ? "h-9 leading-9" : "h-10 leading-10"
        )}
      >
        Search products...
      </div>
    </div>
  );
}

function ActionIcons() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="flex size-9 items-center justify-center rounded-md text-muted-foreground">
        <ShoppingCart className="size-5" />
      </div>
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        <User className="size-4 text-muted-foreground" />
      </div>
    </div>
  );
}
