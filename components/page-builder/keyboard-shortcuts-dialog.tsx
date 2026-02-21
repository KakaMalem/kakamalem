"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";

const shortcuts = [
  { keys: ["Ctrl", "S"], description: "Save draft" },
  { keys: ["Ctrl", "Z"], description: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {s.description}
                </span>
                <div className="flex items-center gap-1">
                  {s.keys.map((key) => (
                    <kbd
                      key={key}
                      className="inline-flex min-w-[1.75rem] items-center justify-center rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Puck also supports drag-and-drop for reordering sections.
          </p>
        </div>
      </div>
    </div>
  );
}
