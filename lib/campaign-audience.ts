export const CAMPAIGN_AUDIENCE_SEGMENTS = [
  "all",
  "no_show",
  "male",
  "female",
  "service_booked",
] as const;

export type CampaignAudienceSegment = (typeof CAMPAIGN_AUDIENCE_SEGMENTS)[number];

export function normalizeCampaignSegment(raw: string | null | undefined): CampaignAudienceSegment {
  const s = String(raw ?? "all")
    .toLowerCase()
    .trim();
  return (CAMPAIGN_AUDIENCE_SEGMENTS as readonly string[]).includes(s)
    ? (s as CampaignAudienceSegment)
    : "all";
}

export const CAMPAIGN_AUDIENCE_LABELS: Record<CampaignAudienceSegment, { title: string; description: string }> = {
  all: {
    title: "All marketing subscribers",
    description: "Clients with marketing opt-in and a valid email.",
  },
  no_show: {
    title: "No-show clients",
    description: "Clients with at least one appointment marked as no-show.",
  },
  male: {
    title: "Male clients",
    description: "Uses the sex field on the client profile (e.g. men’s / barbering). Clients without sex set are excluded.",
  },
  female: {
    title: "Female clients",
    description: "Uses the sex field on the client profile. Clients without sex set are excluded.",
  },
  service_booked: {
    title: "Booked a specific service",
    description: "Clients who have had any appointment for the service you pick (any status).",
  },
};

export function audienceSummaryLine(
  segment: CampaignAudienceSegment,
  serviceName?: string | null
): string {
  if (segment === "service_booked") {
    const t = serviceName?.trim();
    return t ? `Booked: ${t}` : "Booked a specific service (service not on file)";
  }
  return CAMPAIGN_AUDIENCE_LABELS[segment].title;
}
