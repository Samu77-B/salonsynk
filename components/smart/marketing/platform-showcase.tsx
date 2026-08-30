"use client";

import { OutcomeShowcase } from "@/components/marketing/outcome-showcase";
import { PlatformIcon } from "@/components/smart/marketing/platform-icons";
import type { SmartMarketingPlatformId, SMART_SHOWCASE_TABS } from "@core/config/smart-site";

type PlatformShowcaseProps = {
  tabs: typeof SMART_SHOWCASE_TABS;
};

export function PlatformShowcase({ tabs }: PlatformShowcaseProps) {
  return (
    <OutcomeShowcase
      id="platforms"
      sectionLabel="Our platforms"
      sectionTitle="built for every side of the industry."
      sectionSubtitle="Pick your world — see how each Synk platform handles the day-to-day."
      tabs={tabs}
      variant="smart"
      productBadge="Platform"
      renderIcon={(tabId) => (
        <PlatformIcon platform={tabId as SmartMarketingPlatformId} className="h-6 w-6" />
      )}
    />
  );
}
