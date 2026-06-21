"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { DashboardMode } from "./dashboard-mode";
import { DASHBOARD_MODE_STORAGE_KEY } from "./dashboard-mode";
import { ModeSwitch } from "./mode-switch";
import { ClassicModeView } from "./classic-mode-view";
import { AiAssistedModeView } from "./ai-assisted-mode-view";

/**
 * Dual-mode dashboard shell: Classic (diary + widgets) or AI-Assisted (chat + Quick Fill).
 * See modes/README.md for architecture.
 */
export function DashboardModeShell({
  salonName,
  classicContent,
}: {
  salonName: string;
  classicContent: ReactNode;
}) {
  const [mode, setMode] = useState<DashboardMode>("classic");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
      if (stored === "classic" || stored === "ai") setMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const handleModeChange = useCallback((next: DashboardMode) => {
    setMode(next);
    try {
      localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="min-w-0 space-y-4">
      <ModeSwitch mode={mode} onModeChange={handleModeChange} />
      {mode === "classic" ? (
        <ClassicModeView>{classicContent}</ClassicModeView>
      ) : (
        <AiAssistedModeView salonName={salonName} />
      )}
    </div>
  );
}
