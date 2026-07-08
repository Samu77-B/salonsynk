import type { ReactNode } from "react";
import { dashboardSectionClass } from "./ui";

type DashboardPageProps = {
  children: ReactNode;
  /** Content max-width preset */
  width?: "narrow" | "default" | "wide" | "full";
  className?: string;
};

const WIDTH_CLASS = {
  narrow: "max-w-lg",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-[1600px]",
} as const;

/** Page container — shell already provides outer padding. */
export function DashboardPage({ children, width = "wide", className = "" }: DashboardPageProps) {
  return (
    <div className={`mx-auto w-full min-w-0 ${WIDTH_CLASS[width]} ${className}`.trim()}>
      {children}
    </div>
  );
}

type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function DashboardPageHeader({ title, description, actions }: DashboardPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type DashboardSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function DashboardSection({ title, description, children, className = "", id }: DashboardSectionProps) {
  return (
    <section id={id} className={`${dashboardSectionClass} ${className}`.trim()}>
      {title ? <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

type DashboardDisclosureProps = {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

/** Collapsible panel — keeps long forms off the main scroll path. */
export function DashboardDisclosure({ title, summary, children, defaultOpen = false }: DashboardDisclosureProps) {
  return (
    <details className={`group ${dashboardSectionClass}`} open={defaultOpen || undefined}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {summary ? <p className="mt-0.5 text-sm text-muted">{summary}</p> : null}
          </div>
          <span
            className="mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </div>
      </summary>
      <div className="mt-4 border-t border-border pt-4">{children}</div>
    </details>
  );
}
