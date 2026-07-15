import { SynkPlatformFooter } from "@/components/marketing/synk-platform-footer";
import { SITE } from "@/config/site";

export function MarketingSiteFooter() {
  return (
    <SynkPlatformFooter
      borderColor="rgba(255,255,255,0.1)"
      backgroundColor="#2b373f"
      studio={SITE.studio}
      email={SITE.email}
    />
  );
}
