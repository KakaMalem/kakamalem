"use client";

import { useEditorContext } from "@/lib/page-builder/editor-context";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { FooterConfig } from "@/lib/theme/layout-types";
import { defaultFooterConfig } from "@/lib/theme/layout-types";

const colorSchemeClasses: Record<
  FooterConfig["colorScheme"],
  { bg: string; text: string }
> = {
  light: { bg: "bg-muted/30", text: "text-foreground" },
  dark: { bg: "bg-gray-900", text: "text-white" },
  primary: { bg: "bg-primary", text: "text-primary-foreground" },
  custom: { bg: "", text: "" },
};

const paddingClasses: Record<FooterConfig["padding"], string> = {
  compact: "py-6",
  normal: "py-8",
  spacious: "py-14",
};

/**
 * Puck render component for the StoreFooter section.
 * Reads ALL settings from Puck props (config object).
 */
export function StoreFooterPreview({
  config: _config,
}: {
  config?: FooterConfig;
}) {
  const config = { ...defaultFooterConfig, ..._config };
  const { storeName, logoUrl: editorLogoUrl } = useEditorContext();

  const scheme =
    colorSchemeClasses[config.colorScheme] ?? colorSchemeClasses.light;
  const customStyle =
    config.colorScheme === "custom"
      ? {
          backgroundColor: config.backgroundColor || undefined,
          color: config.textColor || undefined,
        }
      : undefined;

  const currentYear = new Date().getFullYear();
  const copyright =
    config.copyrightText ||
    `\u00A9 ${currentYear} ${storeName}. All rights reserved.`;

  if (config.footerStyle === "minimal") {
    return (
      <footer
        className={cn(
          "border-t",
          scheme.bg,
          scheme.text,
          paddingClasses[config.padding]
        )}
        style={customStyle}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex shrink-0 items-center gap-2">
              <Logo logoUrl={editorLogoUrl} alt={storeName} size="md" />
              <span className="font-semibold">{storeName}</span>
            </div>
            <div className="flex items-center gap-4">
              {["Home", "Products", "Contact"].map((link) => (
                <span key={link} className="text-sm opacity-70">
                  {link}
                </span>
              ))}
            </div>
            <p className="text-sm opacity-60">{copyright}</p>
          </div>
        </div>
      </footer>
    );
  }

  if (config.footerStyle === "centered") {
    return (
      <footer
        className={cn(
          "border-t",
          scheme.bg,
          scheme.text,
          paddingClasses[config.padding]
        )}
        style={customStyle}
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <Logo logoUrl={editorLogoUrl} alt={storeName} size="lg" />
              <span className="text-lg font-semibold">{storeName}</span>
            </div>
            {config.showSocialLinks && (
              <div className="flex gap-3">
                {["FB", "IG", "TW"].map((s) => (
                  <span
                    key={s}
                    className="flex size-8 items-center justify-center rounded-full bg-muted/50 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {["Home", "Products", "Categories", "Contact"].map((link) => (
                <span key={link} className="text-sm opacity-70">
                  {link}
                </span>
              ))}
            </div>
            {/* Custom columns */}
            {config.customColumns.length > 0 && (
              <div className="flex flex-wrap justify-center gap-8">
                {config.customColumns.map((col, i) => (
                  <div key={i} className="text-center">
                    {col.title && (
                      <h4 className="mb-2 text-sm font-semibold">
                        {col.title}
                      </h4>
                    )}
                    <div className="flex flex-col gap-1">
                      {col.links.map((link, j) => (
                        <span key={j} className="text-sm opacity-60">
                          {link.label || "Link"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm opacity-60">{copyright}</p>
          </div>
        </div>
      </footer>
    );
  }

  // Standard (default)
  return (
    <footer
      className={cn(
        "border-t",
        scheme.bg,
        scheme.text,
        paddingClasses[config.padding]
      )}
      style={customStyle}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Store info column */}
          <div className="space-y-3">
            <div className="flex shrink-0 items-center gap-2">
              <Logo logoUrl={editorLogoUrl} alt={storeName} size="lg" />
              <span className="text-lg font-semibold tracking-tight">
                {storeName}
              </span>
            </div>
            <p className="text-sm opacity-60">Store description goes here...</p>
          </div>

          {/* Quick Links */}
          {config.showQuickLinks && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Quick Links
              </h3>
              <div className="flex flex-col gap-2">
                {["Home", "All Products", "Categories"].map((link) => (
                  <span key={link} className="text-sm opacity-60">
                    {link}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          {config.showCategories && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Categories
              </h3>
              <div className="flex flex-col gap-2">
                {["Category 1", "Category 2", "Category 3"].map((cat) => (
                  <span key={cat} className="text-sm opacity-60">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          {config.showContact && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Contact Us
              </h3>
              <div className="flex flex-col gap-2">
                <span className="text-sm opacity-60">email@example.com</span>
                <span className="text-sm opacity-60">+1 234 567 890</span>
              </div>
            </div>
          )}

          {/* Custom columns */}
          {config.customColumns.map((col, i) => (
            <div key={i} className="space-y-3">
              {col.title && (
                <h3 className="text-sm font-semibold uppercase tracking-wider">
                  {col.title}
                </h3>
              )}
              <div className="flex flex-col gap-2">
                {col.links.map((link, j) => (
                  <span key={j} className="text-sm opacity-60">
                    {link.label || "Link"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Newsletter preview */}
        {config.showNewsletter && (
          <div className="mt-8 border-t pt-6">
            <div className="mx-auto max-w-md text-center">
              <h3 className="text-sm font-semibold">
                Subscribe to our newsletter
              </h3>
              <div className="mt-2 flex gap-2">
                <div className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm leading-9 opacity-50">
                  your@email.com
                </div>
                <div className="h-9 rounded-md bg-primary px-4 text-sm leading-9 text-primary-foreground">
                  Subscribe
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <p className="text-center text-sm opacity-60">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
