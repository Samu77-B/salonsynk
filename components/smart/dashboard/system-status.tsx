type StatusTone = "ok" | "warn" | "down";

type SystemRow = {
  name: string;
  status: string;
  tone: StatusTone;
};

const CORE_SYSTEMS: SystemRow[] = [
  { name: "SalonSynk", status: "Operational", tone: "ok" },
  { name: "BarberSynk", status: "Operational", tone: "ok" },
  { name: "NailSynk", status: "Operational", tone: "ok" },
];

const TONE_TEXT: Record<StatusTone, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  down: "text-red-400",
};

const TONE_DOT: Record<StatusTone, string> = {
  ok: "bg-emerald-400 animate-pulse",
  warn: "bg-amber-400",
  down: "bg-red-400",
};

type SystemStatusProps = {
  paysynk?: { status: string; tone: StatusTone };
};

export function SystemStatus({ paysynk }: SystemStatusProps) {
  const systems: SystemRow[] = [
    ...CORE_SYSTEMS,
    paysynk
      ? { name: "PaySynk", status: paysynk.status, tone: paysynk.tone }
      : { name: "PaySynk", status: "Unavailable", tone: "down" },
    { name: "SmartSynk API", status: "Operational", tone: "ok" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-semibold">System Status</h3>
      <ul className="mt-4 space-y-3">
        {systems.map((sys) => (
          <li key={sys.name} className="flex items-center justify-between text-sm">
            <span>{sys.name}</span>
            <span className={`flex items-center gap-2 ${TONE_TEXT[sys.tone]}`}>
              <span className={`h-2 w-2 rounded-full ${TONE_DOT[sys.tone]}`} />
              {sys.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardFooter() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-3 text-xs text-muted">
      <div className="flex flex-wrap gap-4 sm:gap-6">
        <span>System Uptime: 99.98%</span>
        <span>API Response: 142ms</span>
        <span>Data Sync: Real-time</span>
        <span>Active Users: —</span>
      </div>
      <div className="flex items-center gap-4">
        <span>© {new Date().getFullYear()} SmartSynk.net</span>
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          All systems operational
        </span>
      </div>
    </footer>
  );
}
