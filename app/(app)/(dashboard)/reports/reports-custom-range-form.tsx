const inputClass =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

export function ReportsCustomRangeForm({
  defaultFrom,
  defaultTo,
  includeProducts,
}: {
  defaultFrom: string;
  defaultTo: string;
  /** Preserve product-sales toggle when applying a custom range. */
  includeProducts?: boolean;
}) {
  return (
    <form action="/reports" method="get" className="rounded-lg border border-border bg-white/5 p-4">
      <input type="hidden" name="range" value="custom" />
      {includeProducts ? <input type="hidden" name="products" value="1" /> : null}
      <h2 className="text-sm font-semibold text-foreground">Choose date range</h2>
      <p className="mt-1 text-xs text-muted">
        Select any period up to one year (inclusive). Figures are compared to the previous period of the same length.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[140px] flex-col gap-1 text-xs text-muted">
          <span>From</span>
          <input type="date" name="from" required defaultValue={defaultFrom} className={inputClass} />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs text-muted">
          <span>To</span>
          <input type="date" name="to" required defaultValue={defaultTo} className={inputClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-background hover:opacity-90 sm:mb-px"
        >
          Apply range
        </button>
      </div>
    </form>
  );
}
