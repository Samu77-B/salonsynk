import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getPageHelpContext } from "@/lib/help/page-context";
import { SYNKAI_AGENT_NAME } from "@/lib/ai/synkai-brand";

export const maxDuration = 60;

export async function POST(req: Request) {
  const salonContext = await getCurrentUserSalon();
  if (!salonContext) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      { error: `${SYNKAI_AGENT_NAME} is not configured. Add OPENAI_API_KEY to the server environment.` },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body as { messages?: UIMessage[]; pathname?: string };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Missing messages" }, { status: 400 });
  }

  const pathname = typeof raw.pathname === "string" ? raw.pathname : "/";
  const page = getPageHelpContext(pathname);

  const modelMessages = await convertToModelMessages(messages);

  const system = `You are ${SYNKAI_AGENT_NAME}, the SalonSynk assistant for logged-in salon staff.

Current page: ${page.pageLabel} (id: ${page.pageId})
URL path: ${pathname}

Authoritative context for this page (do not contradict):
${page.knowledge}

Behaviour:
- Use clear UK English. Prefer short steps or bullets for procedures.
- If something is not covered above, say you are not sure and suggest the Help page in the app or contacting support — do not invent features.
- Never ask for passwords, card numbers, or API keys.
- You are not a lawyer or accountant; do not give binding legal or tax advice.

Salon name (for natural wording): ${salonContext.salon.name}`;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
