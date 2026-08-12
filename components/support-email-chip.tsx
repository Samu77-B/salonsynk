import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@core/config/support";

/** Boxed support mailto used in salon / barber / nail dashboard headers. */
export function SupportEmailChip({ className = "" }: { className?: string }) {
  return (
    <a
      href={SUPPORT_MAILTO}
      className={`inline-flex items-center rounded border border-border bg-foreground/5 px-2.5 py-1 text-xs text-foreground whitespace-nowrap transition-colors hover:bg-foreground/10 hover:border-foreground/25 ${className}`}
      title={`Email support: ${SUPPORT_EMAIL}`}
    >
      {SUPPORT_EMAIL}
    </a>
  );
}
