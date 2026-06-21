import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { findCalendarGapsForSalon, buildLastMinutePromotion } from "@/lib/ai/calendar-gaps";

export async function GET() {
  const salonContext = await getCurrentUserSalon();
  if (!salonContext) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gaps = await findCalendarGapsForSalon(salonContext.salon.id);
    const salonName = salonContext.salon.name;
    const promotions = gaps.map((gap) => ({
      gap,
      promotion: buildLastMinutePromotion(gap, salonName),
      bookingPrefillUrl: `/book/${salonContext.salon.slug}?stylist=${encodeURIComponent(gap.stylistId)}&start=${encodeURIComponent(gap.startIso)}`,
    }));

    return Response.json({ gaps: promotions });
  } catch (e) {
    console.error("[api/ai/gap-fill GET]", e);
    return Response.json({ error: "Failed to scan calendar gaps" }, { status: 500 });
  }
}
