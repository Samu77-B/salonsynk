"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SITE } from "@core/config/site";

const SALON_HOSTS = ["salonsynk.com", "www.salonsynk.com", "localhost"];

function hashHasAuthTokens(hash: string): boolean {
  return hash.includes("access_token") || hash.includes("error=");
}

function parseHashType(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("type");
}

function passwordSetupPath(type: string | null): string {
  const needsPassword = type === "recovery" || type === "invite" || type === "signup";
  return needsPassword ? "/update-password?next=/billing" : "/dashboard";
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
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hashHasAuthTokens(hash)) return;

    if (!isSalonHost(window.location.hostname) && hash.includes("access_token")) {
      window.location.replace(`${SITE.url.replace(/\/$/, "")}${hash}`);
      return;
    }

    if (hash.includes("error=")) {
      window.history.replaceState(null, "", window.location.pathname);
      router.replace("/login?error=auth");
      return;
    }

    const type = parseHashType(hash);
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event !== "SIGNED_IN" && event !== "PASSWORD_RECOVERY" && event !== "TOKEN_REFRESHED") {
        return;
      }

      data.subscription.unsubscribe();
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.replace(passwordSetupPath(type));
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.replace(passwordSetupPath(type));
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  return null;
}
