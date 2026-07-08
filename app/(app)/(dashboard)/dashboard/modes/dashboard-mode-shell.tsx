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
      <div className="sticky top-[3.75rem] z-20 rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4">
        <DashboardModeToggle compact />
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
