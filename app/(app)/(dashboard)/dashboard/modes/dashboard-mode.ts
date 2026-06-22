import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

/** Dashboard view modes — persisted client-side via `DASHBOARD_MODE_STORAGE_KEY`. */
export type DashboardMode = "classic" | "ai";

export const DASHBOARD_MODE_STORAGE_KEY = "salonsynk-dashboard-mode";

export const DASHBOARD_MODE_LABELS: Record<DashboardMode, string> = {
  classic: "Classic Mode",
  ai: `${SYNKAI_AGENT_NAME} Mode`,
};
