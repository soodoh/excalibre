import { useState, useCallback } from "react";

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderLayout = "paginated" | "scrolled";

export type ReaderSettings = {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ReaderTheme;
  layout: ReaderLayout;
  margin: number;
};

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  fontFamily: "Georgia, serif",
  lineHeight: 1.6,
  theme: "dark",
  layout: "paginated",
  margin: 48,
};

const STORAGE_KEY = "excalibre-reader-settings";

function loadSettings(): ReaderSettings {
  if (globalThis.localStorage === undefined) {
    return DEFAULT_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(stored) as Partial<ReaderSettings>),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function useReaderSettings(): {
  settings: ReaderSettings;
  updateSettings: (updates: Partial<ReaderSettings>) => void;
  resetSettings: () => void;
} {
  const [settings, setSettingsState] = useState<ReaderSettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<ReaderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
