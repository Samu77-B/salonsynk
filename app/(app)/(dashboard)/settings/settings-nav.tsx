import Link from "next/link";

export function SettingsNav({ current = "general" }: { current?: "general" | "services" }) {
  const base = "rounded-lg px-3 py-2 text-sm";
  const active = "bg-accent text-background font-medium";
  const inactive = "text-muted hover:text-foreground hover:bg-white/5";

  return (
    <nav className="mb-6 flex items-center gap-2" aria-label="Settings sections">
      <Link href="/settings" className={`${base} ${current === "general" ? active : inactive}`}>
        General
      </Link>
      <Link href="/services" className={`${base} ${current === "services" ? active : inactive}`}>
        Services
      </Link>
    </nav>
  );
}
