import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { SITE } from "@/config/site";
/* eslint-disable @next/next/no-img-element */

export function MarketingSiteFooter() {
  return (
    <SynkPlatformFooter
      borderColor="rgba(255,255,255,0.1)"
      backgroundColor="#2b373f"
      studio={SITE.studio}
      email={SITE.email}
      logo={
        <img
          src="/imgs/salon/salonsynk-logo-wht.png"
          alt={SITE.name}
          className="h-10 w-auto max-w-[min(100%,16rem)]"
        />
      }
    />
  );
}
