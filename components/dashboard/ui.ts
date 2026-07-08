/** Shared Tailwind class strings for the salon dashboard. */

export const dashboardInputClass =
  "dashboard-field min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40";

export const dashboardSelectClass = `${dashboardInputClass} pr-8`;

export const dashboardTextareaClass = `${dashboardInputClass} resize-y min-h-[5rem]`;

export const dashboardBtnPrimaryClass =
  "dashboard-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";

export const dashboardBtnSecondaryClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50";

export const dashboardBtnGhostClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50";

export const dashboardCardClass =
  "rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5";

export const dashboardSectionClass =
  "rounded-xl border border-border bg-card p-4 sm:p-6";
