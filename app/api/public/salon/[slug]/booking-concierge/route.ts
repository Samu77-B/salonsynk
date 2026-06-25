import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { loadPublicSalonBySlug } from "@/lib/ai/load-public-salon-catalog";
import { buildPublicConciergePrompt, createPublicBookingTools } from "@/lib/ai/public-booking-tools";
import { checkPublicRateLimit } from "@/lib/ai/public-rate-limit";

export const maxDuration = 60;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rate = checkPublicRateLimit(`concierge:${slug}:${clientIp(req)}`);
  if (!rate.ok) {
    return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json({ error: "AI booking is not available right now." }, { status: 503 });
  }

  const catalog = await loadPublicSalonBySlug(slug);
  if (!catalog) {
    return Response.json({ error: "Salon not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body as { messages?: UIMessage[] };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Missing messages" }, { status: 400 });
  }

  const tools = createPublicBookingTools(catalog);
  const system = buildPublicConciergePrompt(catalog);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
