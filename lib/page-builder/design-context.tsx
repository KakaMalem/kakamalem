"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ThemeConfig } from "@/lib/theme/types";
import { defaultThemeConfig } from "@/lib/theme/presets";
import { themeConfigToCssVars } from "@/lib/theme/css-vars";

type DesignState = {
  theme: ThemeConfig;
};

type DesignContextValue = {
  state: DesignState;
  updateTheme: (update: Partial<ThemeConfig>) => void;
  resetToDefault: () => void;
  isDirty: boolean;
};

const DesignContext = createContext<DesignContextValue | null>(null);

// Font CSS variable mapping — matches storefront layout
const fontVarMap: Record<string, string> = {
  geist: "",
  inter: "var(--font-inter)",
  "dm-sans": "var(--font-dm-sans)",
  poppins: "var(--font-poppins)",
  "noto-naskh-arabic": "var(--font-noto-naskh-arabic)",
};

export function DesignProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ThemeConfig;
}) {
  const [state, setState] = useState<DesignState>({
    theme: initialTheme,
  });

  const [initialState] = useState<DesignState>({
    theme: initialTheme,
  });

  const updateTheme = useCallback((update: Partial<ThemeConfig>) => {
    setState((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...update },
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    setState({
      theme: defaultThemeConfig,
    });
  }, []);

  const isDirty = JSON.stringify(state) !== JSON.stringify(initialState);

  const contextValue = useMemo<DesignContextValue>(
    () => ({
      state,
      updateTheme,
      resetToDefault,
      isDirty,
    }),
    [state, updateTheme, resetToDefault, isDirty]
  );

  // Generate live CSS from current design state for real-time preview
  const themeCss = themeConfigToCssVars(state.theme);
  const fontFamily = fontVarMap[state.theme.fontFamily];
  const fontOverrideCss = fontFamily ? `--font-sans:${fontFamily};` : "";

  return (
    <DesignContext.Provider value={contextValue}>
      <style
        dangerouslySetInnerHTML={{
          __html: `#puck-preview-frame :root,.puck-root{${themeCss};${fontOverrideCss}}`,
        }}
      />
      {children}
    </DesignContext.Provider>
  );
}

export function useDesignContext(): DesignContextValue {
  const ctx = useContext(DesignContext);
  if (!ctx) {
    throw new Error("useDesignContext must be used within a DesignProvider");
  }
  return ctx;
}
