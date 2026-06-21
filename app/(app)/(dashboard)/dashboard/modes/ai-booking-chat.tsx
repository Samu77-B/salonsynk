"use client";

import { useRouter } from "next/navigation";
import { AiChatUi } from "@/components/ai/ai-chat-ui";

export function AiBookingChat({ salonName }: { salonName: string }) {
  const router = useRouter();

  return (
    <AiChatUi
      className="dashboard-mode-ai"
      apiUrl="/api/ai/booking-assistant"
      title="AI-Assisted Booking"
      subtitle={`Ask in plain language to check availability, book, or reschedule at ${salonName}. Changes sync to Classic Mode.`}
      assistantLabel="Booking assistant"
      placeholder="Book a haircut with Sarah on Tuesday morning…"
      emptyPrompts={[
        "Book a haircut with Sarah on Tuesday morning for Emma",
        "What times is James free tomorrow for a blow dry?",
        "Reschedule Sophie's colour to Friday at 2pm",
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
