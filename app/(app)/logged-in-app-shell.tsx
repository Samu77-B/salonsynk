"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import type { DashboardTheme } from "./dashboard-theme";

const STORAGE_KEY = "salonsynk-dashboard-theme";

export function LoggedInAppShell({
  children,
  userEmail,
  isSuperAdmin,
  currentSalon,
  adminSalons,
}: {
  children: React.ReactNode;
  userEmail: string | undefined;
  isSuperAdmin: boolean;
  currentSalon?: { id: string; name: string; slug: string };
  adminSalons?: { id: string; name: string }[];
}) {
  const [theme, setThemeState] = useState<DashboardTheme>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setThemeState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const shellClass =
    theme === "dark" ? "app-shell-dark" : "app-shell-light";

  const mainSurfaceClass =
    theme === "dark"
      ? "bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950"
      : "bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-100";

  return (
    <div
      className={`${shellClass} min-h-screen flex flex-col overflow-x-hidden bg-background text-foreground`}
    >
      <AppHeader
        userEmail={userEmail}
        isSuperAdmin={isSuperAdmin}
        currentSalon={currentSalon}
        adminSalons={adminSalons}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col text-foreground ${mainSurfaceClass}`}
      >
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
