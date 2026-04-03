export type ReportRangePdf = "daily" | "weekly" | "monthly" | "custom";

export type ReportPdfPayload = {
  salonName: string;
  range: ReportRangePdf;
  /** YYYY-MM-DD when range is custom (for filenames). */
  customFromYmd?: string;
  customToYmd?: string;
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
  /** When true, PDF includes retail / product sales section. */
  includeProductSales?: boolean;
  totalProductSales?: string;
  productSalesDelta?: string;
  topProductsRetail?: { name: string; count: number; sales: string }[];
};
