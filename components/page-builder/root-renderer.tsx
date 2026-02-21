"use client";

/**
 * Puck root.render wrapper.
 * Header and footer are now rendered as pinned Puck sections
 * (StoreHeader / StoreFooter), so this root wrapper just provides
 * the overall page container.
 */
export function RootRenderer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      {children}
    </div>
  );
}

/**
 * Puck root.render — receives { children } from the editor.
 * Exported separately so config.ts can import it without JSX.
 */
export function RootRender({ children }: { children: React.ReactNode }) {
  return <RootRenderer>{children}</RootRenderer>;
}
