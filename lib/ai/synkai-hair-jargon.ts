/**
 * UK salon / hairdressing terms for SynkAI prompts (staff booking, public concierge, public Q&A).
 * Map casual client language to intents — always pick the closest **bookable service name** from the catalogue.
 */
export const SYNKAI_HAIR_JARGON = `Hairdressing language (UK) — map what clients say to the closest bookable service name in the catalogue:

Cuts & styling
- "trim", "tidy up", "just the ends", "chop", "restyle", "shape up" → haircut / cut services (check men's vs ladies' if both exist)
- "fringe", "bangs" → often part of a cut or a fringe trim service if listed
- "layers", "long layers", "face-framing" → cut / restyle services
- "blow dry", "blowdry", "BD", "wash and blow dry", "cut and blow dry", "C&B", "style out", "finish" → blow dry / styling services (may be bundled with a cut)
- "Brazilian blow dry", "Blow Dry Plus", "smooth blow dry", "sleek blow dry" → match the closest named blow-dry service (including "Plus" variants if that is the exact menu name)
- "updo", "up-do", "hair up", "occasion hair", "party hair", "wedding hair" → updo / occasion styling if listed

Colour
- "roots", "regrowth", "root touch-up", "touch up my colour", "dye my roots" → root tint / regrowth colour
- "full head colour", "all over colour", "global colour", "tint", "permanent colour" → full-head tint / colour services (not category headings like "Colour Tints")
- "toner", "refresh my colour", "gloss", "refresh toner" → toner / gloss services if listed
- "highlights", "foils", "full head foils", "half head foils", "T-section", "parting foils" → foil / highlight services by coverage
- "balayage", "babylights", "freehand colour", "hand-painted highlights" → balayage / freehand services if listed
- "bleach", "lighten", "go blonde", "platinum", "bleach bath" → lightening / bleach services if listed

Treatments
- "Olapex", "bond treatment", "deep conditioning", "treatment", "repair" → treatment services named in the catalogue
- "keratin", "smoothing treatment", "Brazilian (straightening)" → only if a matching treatment service exists (do not confuse with Brazilian blow dry)

Men's / barbering terms
- "skin fade", "fade", "taper", "clipper cut", "buzz cut", "beard trim", "hot towel" → men's / grooming services as named on the menu
- "mens haircut", "men's cut", "gents cut", "gentleman's haircut" → call match_service or read the **Services** list in this prompt and use that row's exact name (never invent labels like "Gents Cut" unless that exact string appears in the catalogue or match_service.serviceName)

When several services could fit, ask one short question using **exact service names from the catalogue or tool suggestions** — never invent a service name that is not in the list.`;

export const SYNKAI_TOOL_USE_FOR_BOOKING = `Booking requests (service + date/time):
- Always call match_service or check_availability before saying a service is missing or unavailable
- Before suggesting an alternative service name to the client, call match_service and quote match_service.serviceName (catalogue spelling)
- Never guess or rename services — jargon examples are NOT menu names
- If check_availability returns a matched service but no slots, say the service was found and offer alternative times — do not say the service does not exist
- If the client only confirms ("yes", "that's fine", "anytime tomorrow"), reuse the last match_service.serviceName — combine with their date/time in check_availability`;

export const SYNKAI_CONFIRMATION_AND_TOOLS = `After the client confirms ("yes", "that's the one", "book it"):
- Reuse the **exact service name** you already matched (from the catalogue or tool suggestions) — never pass "yes" or "that one" as the service name
- Call check_availability (or match_service) again with that exact name if needed
- If a tool returns suggestions[], only offer those names — do not claim a service is unavailable unless the tool said so and listed alternatives
- If the user picks a name you suggested, pass that string verbatim to the next tool call`;
