"use client";

import { AiChatUi } from "@/components/ai/ai-chat-ui";

export function PublicAiConcierge({ slug, salonName }: { slug: string; salonName: string }) {
  return (
    <AiChatUi
      apiUrl={`/api/public/salon/${slug}/booking-concierge`}
      credentials="omit"
      title="AI Concierge"
      subtitle={`Book with ${salonName} — check availability and confirm your appointment in plain language.`}
      assistantLabel="Concierge"
      placeholder="I'd like a blow dry with Sarah next Tuesday…"
      emptyPrompts={[
        "What services do you offer and how long do they take?",
        "Is anyone free this Friday afternoon for a cut and blow dry?",
        "Book a colour appointment with my preferred stylist next week",
      ]}
      className="min-h-[min(60vh,520px)]"
      enableVoice={false}
    />
  );
}
