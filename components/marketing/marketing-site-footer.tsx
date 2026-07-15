import Image from "next/image";
import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { SITE } from "@/config/site";
import siteLogo from "@/salonsynk_logo.png";

export function MarketingSiteFooter() {
  return (
    <SynkPlatformFooter
      variant="light"
      studio={SITE.studio}
      email={SITE.email}
      logo={
        <Image
          src={siteLogo}
          alt={SITE.name}
          className="h-10 w-auto max-w-[min(100%,16rem)]"
          priority={false}
        />
      }
    />
  );
}
