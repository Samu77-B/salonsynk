import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { loadSalonBookingCatalog } from "@/lib/ai/salon-booking-catalog";
import { buildBookingSystemPrompt, createBookingTools } from "@/lib/ai/booking-tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const salonContext = await getCurrentUserSalon();
  if (!salonContext) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      { error: "AI booking is not configured. Add OPENAI_API_KEY to the server environment." },
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

  const isSuperAdmin = await getIsSuperAdmin();
  const isManager = isManagerRole(isSuperAdmin, salonContext.member.role ?? "");
  const pathname = typeof raw.pathname === "string" ? raw.pathname : "/dashboard";

  const catalog = await loadSalonBookingCatalog(salonContext.salon.id, salonContext.salon.name);
  const access = {
    isManager,
    memberRole: salonContext.member.role ?? "staff",
    pathname: isManager ? pathname : undefined,
  };
  const tools = createBookingTools(catalog, access);
  const system = buildBookingSystemPrompt(catalog, access);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}
