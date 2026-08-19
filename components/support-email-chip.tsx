/** Boxed support mailto used in salon / barber / nail dashboard headers. */
export function SupportEmailChip({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  return (
    <a
      href={`mailto:${email}`}
      className={`inline-flex items-center rounded border border-border bg-foreground/5 px-2.5 py-1 text-xs text-foreground whitespace-nowrap transition-colors hover:bg-foreground/10 hover:border-foreground/25 ${className}`}
      title={`Email support: ${email}`}
    >
      {email}
    </a>
  );
}
