"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardMode } from "./dashboard-mode";
import { DASHBOARD_MODE_STORAGE_KEY } from "./dashboard-mode";
import { ModeSwitch } from "./mode-switch";

type DashboardModeContextValue = {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => void;
};

const DashboardModeContext = createContext<DashboardModeContextValue | null>(null);

export function DashboardModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DashboardMode>("classic");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
      if (stored === "classic" || stored === "ai") setModeState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((next: DashboardMode) => {
    setModeState(next);
    try {
      localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <DashboardModeContext.Provider value={value}>{children}</DashboardModeContext.Provider>;
}

export function useDashboardMode(): DashboardModeContextValue | null {
  return useContext(DashboardModeContext);
}

/** Prominent Classic / AI toggle — safe to render in diary toolbar (no-op if provider missing). */
export function DashboardModeToggle({ compact = false }: { compact?: boolean }) {
  const ctx = useDashboardMode();
  if (!ctx) return null;
  return <ModeSwitch mode={ctx.mode} onModeChange={ctx.setMode} compact={compact} />;
}
