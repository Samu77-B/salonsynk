import {
  classifyServicesForBooking,
  parseBookingPolicy,
  type BookingPolicy,
  type ClassifiedService,
} from "@/lib/booking-policy";

export function publicBookingFormModel(params: {
  slug: string;
  salonName: string;
  settings: Record<string, unknown>;
  services: { id: string; name: string; duration_minutes: number; category_id?: string | null }[];
  categories: { id: string; name: string }[];
}): {
  policy: BookingPolicy;
  services: ClassifiedService[];
  clubHref: string;
} {
  const policy = parseBookingPolicy(params.slug, params.settings, params.salonName);
  return {
    policy,
    services: classifyServicesForBooking(params.services, params.categories),
    clubHref: `/club/${params.slug}`,
  };
}
