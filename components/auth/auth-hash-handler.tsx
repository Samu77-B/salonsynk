"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SITE } from "@core/config/site";

const SALON_HOSTS = ["salonsynk.com", "www.salonsynk.com", "localhost"];

function hashHasAuthTokens(hash: string): boolean {
  return hash.includes("access_token") || hash.includes("error=");
}

function passwordSetupPath(type: string | null, isSuperAdmin: boolean): string {
  if (isSuperAdmin) return "/admin";
  const needsPassword = type === "recovery" || type === "invite" || type === "signup";
  return needsPassword ? "/update-password?next=/dashboard" : "/dashboard";
}

function isSalonHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return SALON_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Handles Supabase implicit-flow redirects (#access_token in URL hash).
 * Also moves auth hashes from preview hosts (e.g. *.vercel.app) to salonsynk.com.
 */
export function AuthHashHandler() {
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");

  useEffect(() => {
    const { pathname, search, hash } = window.location;

    // Misconfigured redirects sometimes land ?code= on the homepage instead of /auth/callback.
    if (pathname === "/" && search.includes("code=") && !search.includes("error=")) {
      window.location.replace(`/auth/callback${search}`);
      return;
    }

    if (!hash || !hashHasAuthTokens(hash)) return;

    if (!isSalonHost(window.location.hostname) && hash.includes("access_token")) {
      window.location.replace(`${SITE.url.replace(/\/$/, "")}${hash}`);
      return;
    }

    if (hash.includes("error=")) {
      window.history.replaceState(null, "", window.location.pathname);
      window.location.assign("/login?error=auth");
      return;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken) return;

    setStatus("working");

    void (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      window.history.replaceState(null, "", window.location.pathname + window.location.search);

      if (error) {
        window.location.assign("/login?error=auth");
        return;
      }

      const meRes = await fetch("/api/auth/me");
      const me = meRes.ok ? await meRes.json() : { isSuperAdmin: false };

      setStatus("done");
      window.location.assign(passwordSetupPath(type, me.isSuperAdmin === true));
    })();
  }, []);

  if (status !== "working") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/95 px-4">
      <p className="text-sm text-muted">Setting up your login…</p>
    </div>
  );
}
