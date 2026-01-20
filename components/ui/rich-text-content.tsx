import { cn } from "@/lib/utils";

interface RichTextContentProps {
  /** The HTML content to render */
  html: string;
  /** Additional class names */
  className?: string;
}

/**
 * Renders HTML content from Tiptap editor with proper styling.
 *
 * Note: This component uses dangerouslySetInnerHTML. The HTML content
 * is expected to come from Tiptap editor output, which produces clean
 * HTML from trusted store owners (not user-submitted comments).
 *
 * For user-generated content (like reviews), additional sanitization
 * should be applied.
 */
export function RichTextContent({ html, className }: RichTextContentProps) {
  if (!html || html === "<p></p>") {
    return null;
  }

  return (
    <div
      className={cn("rich-text-content text-muted-foreground", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
