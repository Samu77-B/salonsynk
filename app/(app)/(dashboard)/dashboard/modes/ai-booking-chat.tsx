"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AiChatUi } from "@/components/ai/ai-chat-ui";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

export function AiBookingChat({ salonName }: { salonName: string }) {
  const router = useRouter();
  const requestBody = useCallback(() => ({ pathname: window.location.pathname }), []);

  return (
    <AiChatUi
      className="dashboard-mode-ai"
      apiUrl="/api/ai/booking-assistant"
      requestBody={requestBody}
      title={SYNKAI_AGENT_NAME}
      subtitle={`Bookings, clients, services, products, and client messages for ${salonName}. Owners get SalonSynk help too.`}
      assistantLabel={SYNKAI_AGENT_NAME}
      placeholder="Book Emma for a full head of highlights with Sarah on Tuesday…"
      emptyPrompts={[
        "Book a haircut with Sarah on Tuesday morning for Emma",
        "Send a reminder text for Sophie’s appointment tomorrow",
        "What retail products do we sell?",
        "Cancel James’s 3pm colour appointment",
      ]}
      onFinish={() => {
        queueMicrotask(() => {
          try {
            router.refresh();
          } catch {
            /* ignore */
          }
        });
      }}
    />
  );
}
