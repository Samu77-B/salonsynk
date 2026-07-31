import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const BARBER_HOSTS = ["barbersynk.com", "www.barbersynk.com"];
const NAIL_HOSTS = ["nailsynk.com", "www.nailsynk.com"];
const SALON_HOSTS = ["salonsynk.com", "www.salonsynk.com"];
const SMART_HOSTS = ["smartsynk.net", "www.smartsynk.net"];

function smartLoginUrl(request: NextRequest): URL {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  if (host.startsWith("localhost")) {
    return new URL("/smart/login", request.url);
  }
  return new URL("https://smartsynk.net/login");
}

function isHostMatch(host: string, hosts: string[]): boolean {
  return hosts.some((h) => host.includes(h));
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const { pathname } = request.nextUrl;

  // smartsynk.net: central hub — landing, login, master dashboard
  if (isHostMatch(host, SMART_HOSTS)) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/smart", request.url));
    }
    if (pathname === "/login") {
      return NextResponse.rewrite(new URL("/smart/login", request.url));
    }
    if (pathname === "/signup") {
      return NextResponse.rewrite(new URL("/smart/signup", request.url));
    }
    if (pathname === "/dashboard" || pathname === "/overview") {
      return NextResponse.rewrite(new URL("/smart/overview", request.url));
    }
    const allowed =
      pathname.startsWith("/smart") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      if (pathname.startsWith("/barber") || pathname.startsWith("/nail")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // barbersynk.com: rewrite root to /barber landing page, block salon-only routes
  if (isHostMatch(host, BARBER_HOSTS)) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/barber", request.url));
    }
    if (pathname === "/signup") {
      return NextResponse.rewrite(new URL("/barber/signup", request.url));
    }
    if (pathname === "/login") {
      const loginUrl = smartLoginUrl(request);
      loginUrl.searchParams.set("from", "barber");
      const next = request.nextUrl.searchParams.get("next");
      if (next) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
    const allowed =
      pathname.startsWith("/barber") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/update-password") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // nailsynk.com: rewrite root to /nail landing page, block salon/barber-only routes
  if (isHostMatch(host, NAIL_HOSTS)) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/nail", request.url));
    }
    if (pathname === "/signup") {
      return NextResponse.rewrite(new URL("/nail/signup", request.url));
    }
    if (pathname === "/login") {
      const loginUrl = smartLoginUrl(request);
      loginUrl.searchParams.set("from", "nail");
      const next = request.nextUrl.searchParams.get("next");
      if (next) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname === "/onboarding") {
      return NextResponse.rewrite(new URL("/nail/onboarding", request.url));
    }
    if (pathname.startsWith("/book/")) {
      const slug = pathname.slice("/book/".length);
      return NextResponse.rewrite(new URL(`/nail/book/${slug}`, request.url));
    }
    const allowed =
      pathname.startsWith("/nail") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/update-password") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // salonsynk.com: block /barber/* and /nail/* routes
  if (isHostMatch(host, SALON_HOSTS)) {
    if (pathname.startsWith("/barber") || pathname.startsWith("/nail")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (pathname.startsWith("/smart")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // barbersynk.com: block /nail/* routes
  if (isHostMatch(host, BARBER_HOSTS)) {
    if (pathname.startsWith("/nail")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Block smart routes on product domains (except localhost dev)
  if (
    !isHostMatch(host, SMART_HOSTS) &&
    !host.startsWith("localhost") &&
    pathname.startsWith("/smart")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
