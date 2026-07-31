export type ProductHost = "salon" | "barber" | "nail" | "smart";

export function resolveProductFromHost(host: string): ProductHost {
  const h = host.toLowerCase();
  if (h.includes("barbersynk.com")) return "barber";
  if (h.includes("nailsynk.com")) return "nail";
  if (h.includes("smartsynk.net")) return "smart";
  return "salon";
}

export const DEFAULT_DASHBOARD_PATH: Record<ProductHost, string> = {
  salon: "/dashboard",
  barber: "/barber/dashboard",
  nail: "/nail/queue",
  smart: "/smart/overview",
};
