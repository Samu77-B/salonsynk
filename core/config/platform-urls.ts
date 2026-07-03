/**
 * Canonical public URLs for each Synk platform.
 * Use these in master admin so links work from smartsynk.net (hub) as well as product domains.
 */

import { SITE } from "@core/config/site";
import { BARBER_SITE } from "@core/config/barber-site";
import { NAIL_SITE } from "@core/config/nail-site";

export function salonBookingUrl(slug: string) {
  return `${SITE.url}/book/${slug}`;
}

export function salonShopUrl(slug: string) {
  return `${SITE.url}/shop/${slug}`;
}

export function salonAdminSwitchUrl(salonId: string) {
  return `${SITE.url}/api/admin/switch-salon?salonId=${salonId}`;
}

export function barberJoinUrl(slug: string) {
  return `${BARBER_SITE.url}/barber/join/${slug}`;
}

export function barberAdminSwitchUrl(shopId: string) {
  return `${BARBER_SITE.url}/api/admin/switch-barber-shop?shopId=${shopId}`;
}

export function nailJoinUrl(slug: string) {
  return `${NAIL_SITE.url}/nail/join/${slug}`;
}

export function nailAdminSwitchUrl(salonId: string) {
  return `${NAIL_SITE.url}/api/admin/switch-nail-salon?salonId=${salonId}`;
}

export function salonPublicPathsLabel(slug: string) {
  return `/book/${slug} · /shop/${slug}`;
}

export function salonPublicUrlsLabel(slug: string) {
  const host = SITE.url.replace(/^https?:\/\//, "");
  return `${host}/book/${slug} · ${host}/shop/${slug}`;
}
