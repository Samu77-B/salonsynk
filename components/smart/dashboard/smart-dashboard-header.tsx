type SmartDashboardHeaderProps = {
  title?: string;
  subtitle?: string;
  dateRangeLabel?: string;
};

export function SmartDashboardHeader({
  title = "Overview",
  subtitle = "Unified dashboard across all platforms and locations",
  dateRangeLabel,
}: SmartDashboardHeaderProps) {
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const defaultRange = `${monthAgo.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <header className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted">
          {dateRangeLabel ?? defaultRange}
        </span>
        <span className="flex items-center gap-2 text-sm text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Sync
        </span>
      </div>
    </header>
  );
}
