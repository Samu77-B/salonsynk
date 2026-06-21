export type ClientIntakeStatus = "new" | "existing" | "walk_in";

export function classifyClientIntake(input: {
  clientId: string | null;
  priorCompletedAppointments?: number;
  clientCreatedAt?: string | null;
  salonCreatedAt?: string | null;
}): ClientIntakeStatus {
  if (!input.clientId) return "walk_in";

  const prior = input.priorCompletedAppointments ?? 0;
  if (prior > 0) return "existing";

  if (input.clientCreatedAt && input.salonCreatedAt) {
    const created = new Date(input.clientCreatedAt).getTime();
    const salonStart = new Date(input.salonCreatedAt).getTime();
    const daysSinceCreated = (Date.now() - created) / (24 * 60 * 60 * 1000);
    if (daysSinceCreated <= 30 && created >= salonStart) return "new";
  }

  return prior === 0 ? "new" : "existing";
}

export function clientIntakeLabel(status: ClientIntakeStatus): string {
  switch (status) {
    case "new":
      return "New client";
    case "existing":
      return "Existing client";
    case "walk_in":
      return "Walk-in guest";
  }
}

export function clientIntakeBadgeClass(status: ClientIntakeStatus): string {
  switch (status) {
    case "new":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "existing":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "walk_in":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
}
