/**
 * SalonSynk walkthrough videos for /how-it-works.
 * Add a row here when a new clip is in public/videos/.
 */

export type HowItWorksVideo = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  /** Path under public/, e.g. /videos/tour-01-diary.mp4 */
  src?: string;
  durationLabel?: string;
  /** Shown when src is not ready yet */
  comingSoon?: boolean;
};

export const SALON_HOW_IT_WORKS_VIDEOS: HowItWorksVideo[] = [
  {
    id: "diary",
    title: "Shared diary",
    summary: "One screen for your whole team — hair, brows, and lashes — with day and week views.",
    bullets: [
      "Day view with a column per stylist",
      "Week view for the whole team",
      "Add a walk-in in a few clicks",
      "Drag to reschedule",
      "Right-click for quick actions",
    ],
    src: "/videos/tour-01-diary.mp4",
    durationLabel: "~1 min",
  },
  {
    id: "synkai",
    title: "SynkAI Mode & Smart Scheduler",
    summary:
      "Switch to SynkAI Mode to book by chat, fill empty gaps, and smart-reschedule appointments.",
    bullets: [
      "Book and manage appointments with SynkAI chat",
      "Quick Fill for 30–60 minute calendar gaps",
      "Smart Reschedule suggestions from any booking",
      "Suitable services matched to each open slot",
    ],
    src: "/videos/tour-02-synkai.mp4",
    durationLabel: "~1 min",
    comingSoon: true,
  },
  {
    id: "team",
    title: "Self-employed team",
    summary: "Set each stylist as self-employed — they handle their own payments at the chair.",
    bullets: [
      "Employment type per team member",
      "Show or hide columns on the diary",
      "Mix employees and renters in one salon",
    ],
    comingSoon: true,
  },
  {
    id: "payments",
    title: "In-person payments",
    summary: "Staff take payment on their own card machine — SalonSynk records the sale for your records.",
    bullets: [
      "Works with your existing terminal",
      "Record sales in checkout",
      "You are not processing anyone's money",
    ],
    comingSoon: true,
  },
  {
    id: "booking",
    title: "Online booking",
    summary: "Clients book 24/7 on your branded page and pick their stylist.",
    bullets: [
      "Service and stylist selection",
      "Bookings land on the shared diary",
      "Your branding, your URL",
    ],
    comingSoon: true,
  },
  {
    id: "theme",
    title: "Light or dark dashboard",
    summary: "Switch the dashboard theme to suit your salon.",
    bullets: ["Light mode for bright floors", "Dark mode if you prefer it", "One click in the header"],
    comingSoon: true,
  },
];
