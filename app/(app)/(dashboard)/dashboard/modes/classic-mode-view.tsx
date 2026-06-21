import type { ReactNode } from "react";

/** Isolated shell for the existing diary grid and related dashboard widgets. */
export function ClassicModeView({ children }: { children: ReactNode }) {
  return <div className="dashboard-mode-classic min-w-0 space-y-6">{children}</div>;
}
