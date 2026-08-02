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

/** Map generic /dashboard paths to the correct product dashboard after auth. */
export function resolveAuthNextPath(
  product: ProductHost,
  next: string | null | undefined
): string {
  const fallback = DEFAULT_DASHBOARD_PATH[product];
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;

  // Owner / admin location switch after SmartSynk handoff
  if (
    next.startsWith("/api/admin/switch-salon") ||
    next.startsWith("/api/admin/switch-barber-shop") ||
    next.startsWith("/api/admin/switch-nail-salon")
  ) {
    return next;
  }

  if (product === "barber") {
    if (next === "/dashboard") return "/barber/dashboard";
    if (next.startsWith("/dashboard/")) {
      return `/barber/dashboard${next.slice("/dashboard".length)}`;
    }
    if (next === "/billing") return "/barber/billing";
    if (next.startsWith("/billing/")) {
      return `/barber/billing${next.slice("/billing".length)}`;
    }
    if (next.startsWith("/barber/")) return next;
    return fallback;
  }

  if (product === "nail") {
    if (next === "/dashboard") return "/nail/queue";
    if (next.startsWith("/dashboard/")) {
      return `/nail/queue${next.slice("/dashboard".length)}`;
    }
    if (next === "/billing") return "/nail/billing";
    if (next.startsWith("/billing/")) {
      return `/nail/billing${next.slice("/billing".length)}`;
    }
    if (next.startsWith("/nail/")) return next;
    return fallback;
  }

  if (product === "smart") {
    if (next.startsWith("/smart/")) return next;
    return "/smart/overview";
  }

  if (next.startsWith("/barber/") || next.startsWith("/nail/")) return fallback;
  return next;
}

export function productSiteUrl(product: ProductHost): string {
  if (product === "barber") return "https://barbersynk.com";
  if (product === "nail") return "https://nailsynk.com";
  if (product === "smart") return "https://smartsynk.net";
  return "https://salonsynk.com";
}
