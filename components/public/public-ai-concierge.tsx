"use client";

import { AiChatUi } from "@/components/ai/ai-chat-ui";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

export function PublicAiConcierge({ slug, salonName }: { slug: string; salonName: string }) {
  return (
    <AiChatUi
      apiUrl={`/api/public/salon/${slug}/booking-concierge`}
      credentials="omit"
      title={SYNKAI_AGENT_NAME}
      subtitle={`Book with ${salonName} — check availability and confirm your appointment in plain language.`}
      assistantLabel={SYNKAI_AGENT_NAME}
      placeholder="I'd like a blow dry with Sarah next Tuesday…"
      emptyPrompts={[
        "What services do you offer and how long do they take?",
        "What's the difference between your highlight services?",
        "Is anyone free this Friday afternoon for a cut and blow dry?",
        "What are your opening hours?",
      ]}
      className="min-h-[min(60vh,520px)]"
      enableVoice={false}
    />
  );
}
