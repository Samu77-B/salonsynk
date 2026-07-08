import type { ReactNode } from "react";
import { dashboardFlowClass } from "@/components/dashboard/ui";

/** Isolated shell for the existing diary grid and related dashboard widgets. */
export function ClassicModeView({ children }: { children: ReactNode }) {
  return <div className={`dashboard-mode-classic ${dashboardFlowClass} min-w-0 space-y-6`}>{children}</div>;
}
