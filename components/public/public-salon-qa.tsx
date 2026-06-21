"use client";

import { AiChatUi } from "@/components/ai/ai-chat-ui";

export function PublicSalonQa({ slug, salonName }: { slug: string; salonName: string }) {
  return (
    <AiChatUi
      apiUrl={`/api/public/salon/${slug}/qa`}
      credentials="omit"
      title="Salon QA"
      subtitle={`Ask ${salonName} about services, pricing, policies, and how to book.`}
      assistantLabel="Salon assistant"
      placeholder="What's your cancellation policy?"
      emptyPrompts={[
        "How long does a full head of highlights take?",
        "Do you require a deposit for colour appointments?",
        "What's included in a bridal hair trial?",
      ]}
      className="min-h-[min(60vh,520px)]"
      enableVoice={false}
    />
  );
}
