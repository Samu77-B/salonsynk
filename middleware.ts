import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const BARBER_HOSTS = ["barbersynk.com", "www.barbersynk.com"];
const NAIL_HOSTS = ["nailsynk.com", "www.nailsynk.com"];
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
    // Allow /barber/*, /admin/* (master admin), auth routes, and API
    const allowed =
      pathname.startsWith("/barber") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/onboarding") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // nailsynk.com: rewrite root to /nail landing page, block salon/barber-only routes
  if (NAIL_HOSTS.some((h) => host.includes(h))) {
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/nail", request.url));
    }
    if (pathname === "/signup") {
      return NextResponse.rewrite(new URL("/nail/signup", request.url));
    }
    if (pathname === "/login") {
      return NextResponse.rewrite(new URL("/nail/login", request.url));
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
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // salonsynk.com: block /barber/* and /nail/* routes
  if (SALON_HOSTS.some((h) => host.includes(h))) {
    if (pathname.startsWith("/barber") || pathname.startsWith("/nail")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // barbersynk.com: block /nail/* routes
  if (BARBER_HOSTS.some((h) => host.includes(h))) {
    if (pathname.startsWith("/nail")) {
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
