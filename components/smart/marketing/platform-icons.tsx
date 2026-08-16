import type { SmartPlatformId } from "@core/config/smart-site";

export const SMART_PLATFORM_ICON_SRC: Record<SmartPlatformId, string> = {
  salon: "/imgs/smart/salonsynk-platform-icon.png",
  barber: "/imgs/smart/barbersynk-platform-icon.png",
  nail: "/imgs/smart/nailsynk-platform-icon.png",
};

type PlatformIconProps = {
  platform: SmartPlatformId;
  className?: string;
};

/** Platform icon tinted via currentColor (SmartSynk orange on marketing pages). */
export function PlatformIcon({ platform, className = "h-6 w-6" }: PlatformIconProps) {
  const src = SMART_PLATFORM_ICON_SRC[platform];

  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: "currentColor",
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
      aria-hidden
    />
  );
}

export function SalonSynkIcon(props: Omit<PlatformIconProps, "platform">) {
  return <PlatformIcon platform="salon" {...props} />;
}

export function BarberSynkIcon(props: Omit<PlatformIconProps, "platform">) {
  return <PlatformIcon platform="barber" {...props} />;
}

export function NailSynkIcon(props: Omit<PlatformIconProps, "platform">) {
  return <PlatformIcon platform="nail" {...props} />;
}

/** Cart / payments icon for PaySynk (no PNG mask — PaySynk is not a marketing tab here). */
export function PaySynkIcon({ className = "h-6 w-6" }: Omit<PlatformIconProps, "platform">) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

/** @deprecated Use PlatformIcon or SalonSynkIcon */
export const ScissorsIcon = SalonSynkIcon;

/** @deprecated Use PlatformIcon or BarberSynkIcon */
export const BarberPoleIcon = BarberSynkIcon;

/** @deprecated Use PlatformIcon or NailSynkIcon */
export const NailPolishIcon = NailSynkIcon;
