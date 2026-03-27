import type { JSX } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "src/components/ui/sheet";
import { Button } from "src/components/ui/button";
import { Separator } from "src/components/ui/separator";
import type {
  ReaderSettings,
  ReaderTheme,
  ReaderLayout,
} from "src/hooks/use-reader-settings";
import { cn } from "src/lib/utils";

type ReaderSettingsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReaderSettings;
  onUpdateSettings: (updates: Partial<ReaderSettings>) => void;
  onReset: () => void;
};

const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: "Georgia", value: "Georgia, serif" },
  { label: "System", value: "system-ui, sans-serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
  { label: "Bookerly", value: "Bookerly, Georgia, serif" },
];

const THEMES: Array<{
  label: string;
  value: ReaderTheme;
  bg: string;
  text: string;
  border: string;
}> = [
  {
    label: "Dark",
    value: "dark",
    bg: "bg-zinc-900",
    text: "text-zinc-100",
    border: "border-zinc-600",
  },
  {
    label: "Light",
    value: "light",
    bg: "bg-white",
    text: "text-zinc-900",
    border: "border-zinc-300",
  },
  {
    label: "Sepia",
    value: "sepia",
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-300",
  },
];

const LAYOUTS: Array<{ label: string; value: ReaderLayout }> = [
  { label: "Paginated", value: "paginated" },
  { label: "Scrolled", value: "scrolled" },
];

export function ReaderSettings({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onReset,
}: ReaderSettingsProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-xs">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle>Reader Settings</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 px-4 py-4">
          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="font-size-range" className="text-sm font-medium">
                Font Size
              </label>
              <span className="text-sm text-muted-foreground">
                {settings.fontSize}px
              </span>
            </div>
            <input
              id="font-size-range"
              type="range"
              min={12}
              max={32}
              step={1}
              value={settings.fontSize}
              onChange={(e) =>
                onUpdateSettings({ fontSize: Number(e.target.value) })
              }
              className="w-full accent-green-500"
            />
          </div>

          <Separator />

          {/* Font Family */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Font Family</span>
            <div className="grid grid-cols-2 gap-2">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    settings.fontFamily === font.value
                      ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-border",
                  )}
                  style={{ fontFamily: font.value }}
                  onClick={() => onUpdateSettings({ fontFamily: font.value })}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Line Height */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="line-height-range"
                className="text-sm font-medium"
              >
                Line Height
              </label>
              <span className="text-sm text-muted-foreground">
                {settings.lineHeight.toFixed(1)}
              </span>
            </div>
            <input
              id="line-height-range"
              type="range"
              min={1.2}
              max={2.4}
              step={0.1}
              value={settings.lineHeight}
              onChange={(e) =>
                onUpdateSettings({ lineHeight: Number(e.target.value) })
              }
              className="w-full accent-green-500"
            />
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Theme</span>
            <div className="flex gap-2">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md border px-2 py-3 text-xs font-medium transition-all",
                    theme.bg,
                    theme.text,
                    settings.theme === theme.value
                      ? `${theme.border} ring-2 ring-green-500 ring-offset-1`
                      : theme.border,
                  )}
                  onClick={() => onUpdateSettings({ theme: theme.value })}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Layout */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Layout</span>
            <div className="flex gap-2">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    settings.layout === layout.value
                      ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-border",
                  )}
                  onClick={() => onUpdateSettings({ layout: layout.value })}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Margin */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="margin-range" className="text-sm font-medium">
                Margin
              </label>
              <span className="text-sm text-muted-foreground">
                {settings.margin}px
              </span>
            </div>
            <input
              id="margin-range"
              type="range"
              min={24}
              max={96}
              step={4}
              value={settings.margin}
              onChange={(e) =>
                onUpdateSettings({ margin: Number(e.target.value) })
              }
              className="w-full accent-green-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onReset}
          >
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
