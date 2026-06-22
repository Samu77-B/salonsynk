"use client";

import { AiChatUi } from "@/components/ai/ai-chat-ui";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

export function PublicSalonQa({ slug, salonName }: { slug: string; salonName: string }) {
  return (
    <AiChatUi
      apiUrl={`/api/public/salon/${slug}/qa`}
      credentials="omit"
      title="Salon QA"
      subtitle={`Ask ${salonName} about services, pricing, policies, and how to book.`}
      assistantLabel={SYNKAI_AGENT_NAME}
      placeholder="What's your cancellation policy?"
      emptyPrompts={[
        "How long does a full head of highlights take?",
        "What's included in a balayage appointment?",
        "What are your opening hours?",
        "Do you require a deposit for colour appointments?",
      ]}
      className="min-h-[min(60vh,520px)]"
      enableVoice={false}
    />
  );
}
