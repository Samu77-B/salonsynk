export type AdminSetupLink = {
  href: string;
  label: string;
  primary?: boolean;
};

export function AdminTenantSetupLinks({
  title = "Set up this business",
  description = "Open the live dashboard as master admin to add services, products, team, and more.",
  links,
}: {
  title?: string;
  description?: string;
  links: AdminSetupLink[];
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-border bg-background/60 p-4 shadow-sm space-y-3"
    >
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map(({ href, label, primary }) => (
          <a
            key={href}
            href={href}
            className={
              primary
                ? "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                : "rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white/5"
            }
          >
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
