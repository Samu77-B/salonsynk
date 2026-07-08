"use client";

import { OutcomeShowcase } from "@/components/marketing/outcome-showcase";
import {
  BarberPoleIcon,
  NailPolishIcon,
  ScissorsIcon,
} from "@/components/smart/marketing/platform-card";
import type { SMART_SHOWCASE_TABS } from "@core/config/smart-site";

type PlatformShowcaseProps = {
  tabs: typeof SMART_SHOWCASE_TABS;
};

const PLATFORM_ICONS = {
  salon: ScissorsIcon,
  barber: BarberPoleIcon,
  nail: NailPolishIcon,
} as const;

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
      renderIcon={(tabId) => {
        const Icon = PLATFORM_ICONS[tabId as keyof typeof PLATFORM_ICONS];
        return Icon ? <Icon /> : null;
      }}
    />
  );
}
