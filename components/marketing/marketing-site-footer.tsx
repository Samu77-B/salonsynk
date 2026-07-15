import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { SITE } from "@/config/site";
/* eslint-disable @next/next/no-img-element */

export function MarketingSiteFooter() {
  return (
    <SynkPlatformFooter
      variant="light"
      studio={SITE.studio}
      email={SITE.email}
      logo={
        <img
          src="/imgs/salon/salonsynk-footer-logo-light.png"
          alt={SITE.name}
          className="h-28 w-auto object-contain sm:h-32"
        />
      }
    />
  );
}
