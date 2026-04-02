export type ReportRangePdf = "daily" | "weekly" | "monthly";

export type ReportPdfPayload = {
  salonName: string;
  range: ReportRangePdf;
  rangeLabel: string;
  dateRangeLabel: string;
  salesLabel: string;
  totalSales: string;
  salesDelta: string;
  completedAppointments: number;
  completedDelta: string;
  haircuts: number;
  haircutsDelta: string;
  completionRate: string;
  completionDelta: string;
  topServices: { name: string; count: number; sales: string }[];
  topStylists: { name: string; count: number; sales: string }[];
  totalBookings: number;
  noShows: number;
  canceled: number;
};
