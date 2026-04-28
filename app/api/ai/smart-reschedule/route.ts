import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getCurrentUserSalon } from "@/lib/supabase/salon";

export const maxDuration = 30;

type CandidateSlot = {
  startIso: string;
  endIso: string;
  dayLabel: string;
  timeLabel: string;
  gapBeforeMins: number;
  gapAfterMins: number;
};

type SmartRescheduleBody = {
  appointment: {
    id: string;
    stylistId: string;
    serviceDurationMins: number;
    clientName: string;
  };
  candidates: CandidateSlot[];
};

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Models often wrap JSON in ``` fences or add a short preamble — extract a parsable JSON object. */
function extractJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```/im.exec(trimmed);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  let parsed = safeJsonParse(candidate);
  if (parsed !== null) return parsed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    parsed = safeJsonParse(candidate.slice(start, end + 1));
  }
  return parsed;
}

export async function POST(req: Request) {
  const context = await getCurrentUserSalon();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      { error: "AI is not configured. Add OPENAI_API_KEY to the server environment." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body as Partial<SmartRescheduleBody>;
  const appointment = raw.appointment;
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];

  if (
    !appointment ||
    typeof appointment.id !== "string" ||
    typeof appointment.stylistId !== "string" ||
    typeof appointment.serviceDurationMins !== "number" ||
    typeof appointment.clientName !== "string" ||
    candidates.length === 0
  ) {
    return Response.json({ error: "Missing appointment/candidates" }, { status: 400 });
  }

  const system = `You are an assistant that helps a salon staff member reschedule an appointment.

Goal: Choose the top 3 most efficient new time slots to move the appointment to.

Ranking rules:
- Prefer slots that sit immediately adjacent to existing appointments (minimise dead gaps).
- A 10-minute buffer before and after is already enforced in the candidate list.
- Return exactly 3 suggestions, in best-to-worst order.
- Label the best one as "Optimal Gap-Filler".

Output: Return ONLY strict JSON with this shape:
{
  "picks": [
    { "startIso": "...", "endIso": "...", "label": "Optimal Gap-Filler" | "Good option" | "Alternative", "reason": "..." },
    { "startIso": "...", "endIso": "...", "label": "...", "reason": "..." },
    { "startIso": "...", "endIso": "...", "label": "...", "reason": "..." }
  ]
}`;

  const input = {
    salonName: context.salon.name,
    appointment,
    candidates: candidates.map((c) => ({
      startIso: c.startIso,
      endIso: c.endIso,
      dayLabel: c.dayLabel,
      timeLabel: c.timeLabel,
      gapBeforeMins: c.gapBeforeMins,
      gapAfterMins: c.gapAfterMins,
    })),
  };

  let result: { text: string };
  try {
    result = await generateText({
      model: openai("gpt-4o-mini"),
      system,
      prompt: JSON.stringify(input),
    });
  } catch (err) {
    console.error("[api/ai/smart-reschedule] provider error", err);
    const msg =
      err instanceof Error
        ? err.message
        : "The AI provider request failed. Check OPENAI_API_KEY and server logs.";
    // Surface as 502 so the client shows a friendly message (not a 500).
    return Response.json({ error: msg }, { status: 502 });
  }

  const parsed = extractJsonFromModelText(result.text) ?? safeJsonParse(result.text);
  const picks = (parsed as { picks?: unknown })?.picks;
  if (!Array.isArray(picks) || picks.length !== 3) {
    return Response.json({ error: "AI returned an invalid response" }, { status: 502 });
  }

  const normalized = picks
    .map((p) => p as { startIso?: unknown; endIso?: unknown; label?: unknown; reason?: unknown })
    .filter(
      (p) =>
        typeof p.startIso === "string" &&
        typeof p.endIso === "string" &&
        typeof p.label === "string" &&
        typeof p.reason === "string"
    )
    .slice(0, 3);

  if (normalized.length !== 3) {
    return Response.json({ error: "AI returned an invalid response" }, { status: 502 });
  }

  // Ensure the first label matches the required wording.
  normalized[0] = { ...normalized[0], label: "Optimal Gap-Filler" };

  return Response.json({ error: null, picks: normalized }, { status: 200 });
}

