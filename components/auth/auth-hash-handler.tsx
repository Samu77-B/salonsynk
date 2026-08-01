"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_DASHBOARD_PATH,
  productSiteUrl,
  resolveProductFromHost,
  type ProductHost,
} from "@/lib/platform-host";

function hashHasAuthTokens(hash: string): boolean {
  return hash.includes("access_token") || hash.includes("error=");
}

function passwordSetupPath(type: string | null, product: ProductHost, isSuperAdmin: boolean): string {
  if (isSuperAdmin && product === "smart") return "/smart/overview";
  if (isSuperAdmin) return "/admin";
  const needsPassword = type === "recovery" || type === "invite" || type === "signup";
  const dashboard = DEFAULT_DASHBOARD_PATH[product];
  return needsPassword
    ? `/update-password?next=${encodeURIComponent(dashboard)}`
    : dashboard;
}

async function pendingAdminReturnPath(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/admin-return", { method: "POST" });
    if (!res.ok) return null;
    const data = (await res.json()) as { path?: string | null };
    const path = data.path;
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}

function isProductHost(hostname: string, product: ProductHost): boolean {
  const host = hostname.toLowerCase();
  if (product === "barber") return host.includes("barbersynk.com");
  if (product === "nail") return host.includes("nailsynk.com");
  if (product === "smart") return host.includes("smartsynk.net");
  return host.includes("salonsynk.com") || host === "localhost" || host.startsWith("127.0.0.1");
}

/**
 * Handles Supabase implicit-flow redirects (#access_token in URL hash).
 * Keeps auth on the correct product domain (barber/nail/salon).
 */
export function AuthHashHandler() {
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");

  useEffect(() => {
    const { pathname, search, hash, hostname } = window.location;

    const hasAuthQuery = search.includes("code=") || search.includes("token_hash=");
    if (pathname === "/" && hasAuthQuery && !search.includes("error=")) {
      window.location.replace(`/auth/callback${search}`);
      return;
    }

    if (!hash || !hashHasAuthTokens(hash)) return;

    const product = resolveProductFromHost(hostname);

    if (!isProductHost(hostname, product) && hash.includes("access_token")) {
      window.location.replace(`${productSiteUrl(product)}${hash}`);
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
      const isSuperAdmin = me.isSuperAdmin === true;

      let destination = passwordSetupPath(type, product, isSuperAdmin);
      if (isSuperAdmin) {
        const adminReturn = await pendingAdminReturnPath();
        if (adminReturn) destination = adminReturn;
      }

      setStatus("done");
      window.location.assign(destination);
    })();
  }, []);

  if (status !== "working") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/95 px-4">
      <p className="text-sm text-muted">Setting up your login…</p>
    </div>
  );
}
