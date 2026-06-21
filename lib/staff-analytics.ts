type AppointmentHoursRow = {
  stylist_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
};

type SalesRow = {
  stylist_id: string | null;
  amount_minor: number;
  paid_at: string;
};

export type StaffAnalyticsRow = {
  memberId: string;
  name: string;
  avgWorkingHoursPerWeek: number;
  avgServiceTakingsPerDayMinor: number;
  completedAppointments: number;
  totalSalesMinor: number;
};

function hoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / (60 * 60 * 1000);
}

function distinctDays(isoDates: string[]): number {
  const days = new Set(isoDates.map((d) => d.slice(0, 10)));
  return Math.max(1, days.size);
}

export function buildStaffAnalytics(input: {
  members: { id: string; display_name: string | null; role: string }[];
  appointments: AppointmentHoursRow[];
  sales: SalesRow[];
  periodWeeks: number;
}): StaffAnalyticsRow[] {
  const weeks = Math.max(1, input.periodWeeks);

  return input.members.map((member) => {
    const memberAppts = input.appointments.filter(
      (a) => a.stylist_id === member.id && a.status === "completed"
    );
    const totalHours = memberAppts.reduce((sum, a) => sum + hoursBetween(a.start_time, a.end_time), 0);

    const memberSales = input.sales.filter((s) => s.stylist_id === member.id);
    const totalSalesMinor = memberSales.reduce((sum, s) => sum + Number(s.amount_minor ?? 0), 0);
    const salesDays = distinctDays(memberSales.map((s) => s.paid_at));

    return {
      memberId: member.id,
      name: member.display_name?.trim() || member.role,
      avgWorkingHoursPerWeek: totalHours / weeks,
      avgServiceTakingsPerDayMinor: totalSalesMinor / salesDays,
      completedAppointments: memberAppts.length,
      totalSalesMinor,
    };
  });
}
