import { AiBookingChat } from "./ai-booking-chat";
import { AiGapFillPanel } from "./ai-gap-fill-panel";

/**
 * AI-Assisted dashboard mode — staff booking chat plus proactive gap-filling.
 * Internal tools (reports, client DB) stay in Classic Mode only.
 */
export function AiAssistedModeView({ salonName }: { salonName: string }) {
  return (
    <div className="dashboard-mode-ai min-w-0 space-y-6">
      <AiBookingChat salonName={salonName} />
      <AiGapFillPanel salonName={salonName} />
    </div>
  );
}
