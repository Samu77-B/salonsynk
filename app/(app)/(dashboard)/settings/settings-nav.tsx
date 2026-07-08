import Link from "next/link";

export function SettingsNav({ current = "general" }: { current?: "general" | "services" }) {
  const base = "rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const active = "bg-accent text-background shadow-sm";
  const inactive = "border border-border bg-card text-muted hover:text-foreground hover:bg-foreground/5";

  return (
    <nav className="mb-6 inline-flex flex-wrap gap-2 rounded-xl border border-border bg-card/50 p-1" aria-label="Settings sections">
      <Link href="/settings" className={`${base} ${current === "general" ? active : inactive}`}>
        General
      </Link>
      <Link href="/services" className={`${base} ${current === "services" ? active : inactive}`}>
        Services
      </Link>
    </nav>
  );
}
