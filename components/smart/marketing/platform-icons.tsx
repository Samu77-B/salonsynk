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

/** @deprecated Use PlatformIcon or SalonSynkIcon */
export const ScissorsIcon = SalonSynkIcon;

/** @deprecated Use PlatformIcon or BarberSynkIcon */
export const BarberPoleIcon = BarberSynkIcon;

/** @deprecated Use PlatformIcon or NailSynkIcon */
export const NailPolishIcon = NailSynkIcon;
