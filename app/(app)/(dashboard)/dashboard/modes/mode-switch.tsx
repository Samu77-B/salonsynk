"use client";

import type { DashboardMode } from "./dashboard-mode";
import { DASHBOARD_MODE_LABELS } from "./dashboard-mode";

const MODES: DashboardMode[] = ["classic", "ai"];

export function ModeSwitch({
  mode,
  onModeChange,
  compact = false,
}: {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex w-full min-w-0 ${compact ? "flex-row items-center gap-2" : "flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"}`}
      role="group"
      aria-label="Dashboard mode"
    >
      <p className={`font-medium text-foreground ${compact ? "shrink-0 text-xs" : "text-sm"}`}>
        {compact ? "Mode" : "Calendar view"}
      </p>
      <div
        className={`inline-flex min-w-0 rounded-lg border border-border bg-background p-1 ${
          compact ? "min-h-[40px] flex-1" : "min-h-[44px] w-full sm:w-auto"
        }`}
      >
        {MODES.map((value) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onModeChange(value)}
              className={`min-h-[36px] flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                isActive
                  ? "bg-accent text-background shadow-sm"
                  : "text-muted hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {DASHBOARD_MODE_LABELS[value]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
