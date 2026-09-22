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

/** Rewrite to an internal path, keeping the query string (e.g. `?next=`). */
function rewriteTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const { pathname } = request.nextUrl;

  // smartsynk.net: central hub — landing, login, master dashboard
  if (isHostMatch(host, SMART_HOSTS)) {
    if (pathname === "/") {
      return rewriteTo(request, "/smart");
    }
    if (pathname === "/login") {
      return rewriteTo(request, "/smart/login");
    }
    if (pathname === "/signup") {
      return rewriteTo(request, "/smart/signup");
    }
    if (pathname === "/dashboard" || pathname === "/overview") {
      return rewriteTo(request, "/smart/overview");
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
      return rewriteTo(request, "/barber");
    }
    if (pathname === "/signup") {
      return rewriteTo(request, "/barber/signup");
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
      pathname.startsWith("/auth") ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/sw.js";
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // nailsynk.com: rewrite root to /nail landing page, block salon/barber-only routes
  if (isHostMatch(host, NAIL_HOSTS)) {
    if (pathname === "/") {
      return rewriteTo(request, "/nail");
    }
    if (pathname === "/signup") {
      return rewriteTo(request, "/nail/signup");
    }
    if (pathname === "/login") {
      const loginUrl = smartLoginUrl(request);
      loginUrl.searchParams.set("from", "nail");
      const next = request.nextUrl.searchParams.get("next");
      if (next) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname === "/onboarding") {
      return rewriteTo(request, "/nail/onboarding");
    }
    if (pathname.startsWith("/book/")) {
      return rewriteTo(request, `/nail${pathname}`);
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
