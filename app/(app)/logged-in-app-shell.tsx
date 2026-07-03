"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { HelpAgentWidget } from "./help-agent-widget";
import type { PlatformFeatureId } from "@/config/plans";
import type { DashboardTheme } from "./dashboard-theme";

const STORAGE_KEY = "salonsynk-dashboard-theme";

/** Set to true to show the floating AI help chat again. */
const SHOW_AI_HELP_AGENT = false;

export function LoggedInAppShell({
  children,
  userEmail,
  isSuperAdmin,
  isManager,
  memberRole,
  currentSalon,
  adminSalons,
  enabledFeatures = [],
}: {
  children: React.ReactNode;
  userEmail: string | undefined;
  isSuperAdmin: boolean;
  isManager: boolean;
  memberRole: string | null;
  currentSalon?: { id: string; name: string; slug: string };
  adminSalons?: { id: string; name: string }[];
  enabledFeatures?: PlatformFeatureId[];
}) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<DashboardTheme>("dark");
  const [onSmartHost, setOnSmartHost] = useState(false);

  useEffect(() => {
    setOnSmartHost(window.location.hostname.toLowerCase().includes("smartsynk.net"));
  }, []);

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

  const hideSalonHeader = onSmartHost && pathname.startsWith("/admin");
  const shellClass = hideSalonHeader
    ? "smart-dashboard"
    : theme === "dark"
      ? "app-shell-dark"
      : "app-shell-light";

  return (
    <div
      className={`${shellClass} min-h-screen flex flex-col overflow-x-hidden bg-canvas text-foreground`}
    >
      {!hideSalonHeader && (
        <AppHeader
          userEmail={userEmail}
          isSuperAdmin={isSuperAdmin}
          isManager={isManager}
          memberRole={memberRole}
          currentSalon={currentSalon}
          adminSalons={adminSalons}
          enabledFeatures={enabledFeatures}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}
      <main
        className={`flex min-h-0 min-w-0 flex-1 flex-col text-foreground ${
          hideSalonHeader ? "min-h-screen" : ""
        }`}
      >
        {hideSalonHeader ? (
          children
        ) : (
          <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        )}
      </main>
      {SHOW_AI_HELP_AGENT ? <HelpAgentWidget /> : null}
    </div>
  );
}
