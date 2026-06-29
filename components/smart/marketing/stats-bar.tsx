type StatsBarProps = {
  businesses: number;
  appointments: number;
  transactions: number;
  platforms: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}K+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
  return n.toLocaleString();
}

const STATS = [
  { key: "businesses" as const, label: "Businesses", icon: "users" },
  { key: "appointments" as const, label: "Appointments", icon: "calendar" },
  { key: "transactions" as const, label: "Transactions", icon: "chart" },
  { key: "platforms" as const, label: "Platforms One Ecosystem", icon: "globe" },
];

function StatIcon({ type }: { type: string }) {
  const cls = "h-5 w-5 text-accent";
  if (type === "users")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  if (type === "calendar")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  if (type === "chart")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function StatsBar({ businesses, appointments, transactions, platforms }: StatsBarProps) {
  const values = { businesses, appointments, transactions, platforms };

  return (
    <section className="border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.key} className="flex flex-col items-center gap-2 px-4 py-6 sm:py-8">
            <StatIcon type={stat.icon} />
            <p className="font-heading text-2xl font-bold sm:text-3xl">
              {stat.key === "platforms" ? platforms : formatCount(values[stat.key])}
            </p>
            <p className="text-center text-xs uppercase tracking-wider text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
