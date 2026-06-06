import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const BARBER_HOSTS = ["barbersynk.com", "www.barbersynk.com"];
const SALON_HOSTS = ["salonsynk.com", "www.salonsynk.com"];

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const { pathname } = request.nextUrl;

  // barbersynk.com: rewrite root to /barber landing page, block salon-only routes
  if (BARBER_HOSTS.some((h) => host.includes(h))) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/barber", request.url));
    }
    if (pathname === "/signup") {
      return NextResponse.rewrite(new URL("/barber/signup", request.url));
    }
    if (pathname === "/login") {
      return NextResponse.rewrite(new URL("/barber/login", request.url));
    }
    // Allow /barber/*, /login, /onboarding, /api/*, and auth callback routes
    const allowed =
      pathname.startsWith("/barber") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // salonsynk.com: block /barber/* routes
  if (SALON_HOSTS.some((h) => host.includes(h))) {
    if (pathname.startsWith("/barber")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
