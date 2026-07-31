/**
 * Canonical public URLs for each Synk platform.
 * Use these in master admin so links work from smartsynk.net (hub) as well as product domains.
 */

import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";
import { salonRowHasFeature, type SalonPlanRow } from "@/lib/salon-features";

export function salonWalkInUrl(slug: string) {
  return `${SITE.url}/walk-in/${slug}`;
}

export function salonBookingUrl(slug: string) {
  return `${SITE.url}/book/${slug}`;
}

export function salonShopUrl(slug: string) {
  return `${SITE.url}/shop/${slug}`;
}

export function salonHasPublicShop(row: SalonPlanRow) {
  return salonRowHasFeature(row, "products_shop");
}

export function salonPublicShopUrl(row: SalonPlanRow & { slug: string }) {
  if (!salonHasPublicShop(row)) return null;
  return salonShopUrl(row.slug);
}

function appendNextParam(base: string, next?: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return base;
  const url = new URL(base);
  url.searchParams.set("next", next);
  return url.toString();
}

export function salonAdminSwitchUrl(salonId: string, next = "/dashboard") {
  const base = `${SITE.url}/api/admin/switch-salon?salonId=${encodeURIComponent(salonId)}`;
  return appendNextParam(base, next);
}

export function barberJoinUrl(slug: string) {
  return `${BARBER_SITE.url}/barber/join/${slug}`;
}

export function barberAdminSwitchUrl(shopId: string, next = "/barber/dashboard") {
  const base = `${BARBER_SITE.url}/api/admin/switch-barber-shop?shopId=${encodeURIComponent(shopId)}`;
  return appendNextParam(base, next);
}

export function nailJoinUrl(slug: string) {
  return `${NAIL_SITE.url}/nail/join/${slug}`;
}

export function nailAdminSwitchUrl(salonId: string, next = "/nail/queue") {
  const base = `${NAIL_SITE.url}/api/admin/switch-nail-salon?salonId=${encodeURIComponent(salonId)}`;
  return appendNextParam(base, next);
}

export function salonPublicPathsLabel(slug: string, row?: SalonPlanRow) {
  const booking = `/book/${slug}`;
  const walkIn = `/walk-in/${slug}`;
  const parts = [booking];
  if (!row || salonRowHasFeature(row, "walk_in_queue")) parts.push(walkIn);
  if (row && salonHasPublicShop(row)) parts.push(`/shop/${slug}`);
  return parts.join(" · ");
}

export function salonPublicUrlsLabel(slug: string, row?: SalonPlanRow) {
  const host = SITE.url.replace(/^https?:\/\//, "");
  const booking = `${host}/book/${slug}`;
  const parts = [booking];
  if (!row || salonRowHasFeature(row, "walk_in_queue")) {
    parts.push(`${host}/walk-in/${slug}`);
  }
  if (row && salonHasPublicShop(row)) parts.push(`${host}/shop/${slug}`);
  return parts.join(" · ");
}
