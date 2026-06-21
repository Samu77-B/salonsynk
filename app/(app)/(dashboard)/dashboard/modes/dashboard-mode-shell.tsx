"use client";

import type { ReactNode } from "react";
import { AiAssistedModeView } from "./ai-assisted-mode-view";
import { ClassicModeView } from "./classic-mode-view";
import { DashboardModeProvider, DashboardModeToggle, useDashboardMode } from "./dashboard-mode-context";

function DashboardModeBody({
  salonName,
  classicContent,
}: {
  salonName: string;
  classicContent: ReactNode;
}) {
  const ctx = useDashboardMode();
  const mode = ctx?.mode ?? "classic";

  return (
    <div className="min-w-0 space-y-4">
      <div className="sticky top-0 z-20 -mx-1 rounded-xl border border-accent/30 bg-background/95 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
        <DashboardModeToggle />
      </div>
      {mode === "classic" ? (
        <ClassicModeView>{classicContent}</ClassicModeView>
      ) : (
        <AiAssistedModeView salonName={salonName} />
      )}
    </div>
  );
}

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
  return (
    <DashboardModeProvider>
      <DashboardModeBody salonName={salonName} classicContent={classicContent} />
    </DashboardModeProvider>
  );
}
