import { cn } from "@/lib/utils";
import type { RichTextProps } from "@/lib/page-builder/types";

/** Strip script tags and inline event handlers from HTML */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>/gi, "")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, "");
}

const maxWidthClasses: Record<RichTextProps["maxWidth"], string> = {
  narrow: "max-w-2xl",
  medium: "max-w-4xl",
  full: "max-w-7xl",
};

const paddingClasses: Record<RichTextProps["padding"], string> = {
  none: "py-0",
  small: "py-4",
  medium: "py-8",
  large: "py-16",
};

export function RichTextSection({
  content = "",
  maxWidth = "medium",
  padding = "medium",
}: RichTextProps) {
  if (!content) return null;

  return (
    <section className={cn(paddingClasses[padding], "px-4 sm:px-6 lg:px-8")}>
      <div
        className={cn(
          "prose prose-sm sm:prose-base mx-auto",
          maxWidthClasses[maxWidth],
          // Match existing product description styling
          "[&_a]:text-primary [&_a]:underline",
          "[&_img]:rounded-lg [&_img]:max-w-full",
          "[&_h1]:text-2xl [&_h1]:font-bold",
          "[&_h2]:text-xl [&_h2]:font-semibold",
          "[&_h3]:text-lg [&_h3]:font-semibold",
          "[&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:list-decimal [&_ol]:pl-6"
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    </section>
  );
}
