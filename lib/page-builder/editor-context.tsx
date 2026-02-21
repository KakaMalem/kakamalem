"use client";

import { createContext, useContext } from "react";

type EditorContextValue = {
  tenantId: string;
  storeSlug: string;
  storeName: string;
  logoUrl: string;
  currency: string;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = EditorContext.Provider;

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return ctx;
}
