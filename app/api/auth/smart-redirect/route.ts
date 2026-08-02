import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveUserPlatform,
  getPlatformCallbackUrl,
} from "@core/auth/resolve-user-platform";
import { buildPlatformAuthLink } from "@core/auth/auth-redirect";
import { qualifiesForOwnerHub } from "@core/auth/smart-access";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ type: "error", message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const preferredPlatform = body.platform as "salon" | "barber" | "nail" | undefined;

    const resolution = await resolveUserPlatform(user.id);

    if (resolution.type === "super_admin" || qualifiesForOwnerHub(resolution)) {
      return NextResponse.json({ type: "local", path: "/smart/overview" });
    }

    if (resolution.type === "none") {
      return NextResponse.json({
        type: "error",
        message: "No platform membership found. Contact support for access.",
      });
    }

    if (resolution.type === "multi") {
      if (preferredPlatform) {
        const match = resolution.memberships.find((m) => m.platform === preferredPlatform);
        if (match) {
          const url = await generatePlatformMagicLink(user.email, preferredPlatform);
          if (url) return NextResponse.json({ type: "redirect", url });
        }
      }
      return NextResponse.json({
        type: "picker",
        memberships: resolution.memberships,
      });
    }

    const platform = resolution.type;
    const url = await generatePlatformMagicLink(user.email, platform);
    if (!url) {
      return NextResponse.json({ type: "error", message: "Could not create platform session" });
    }

    return NextResponse.json({ type: "redirect", url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ type: "error", message }, { status: 500 });
  }
}

async function generatePlatformMagicLink(
  email: string,
  platform: "salon" | "barber" | "nail"
): Promise<string | null> {
  const admin = createAdminClient();
  const redirectTo = getPlatformCallbackUrl(platform);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error) {
    console.error("generateLink failed:", error);
    return null;
  }

  return buildPlatformAuthLink(data, platform, "magiclink");
}
