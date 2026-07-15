import Image from "next/image";

export function HubGraphic() {
  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80">
      {/* Outer rings */}
      <div className="smart-hub-ring absolute inset-0 rounded-full border border-accent/20" />
      <div
        className="smart-hub-ring absolute inset-4 rounded-full border border-accent/30"
        style={{ animationDelay: "0.5s" }}
      />
      <div
        className="smart-hub-ring absolute inset-8 rounded-full border border-accent/40"
        style={{ animationDelay: "1s" }}
      />
      {/* Glow pedestal */}
      <div className="absolute bottom-8 left-1/2 h-4 w-32 -translate-x-1/2 rounded-full bg-accent/30 blur-xl" />
      <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-card border border-accent/50 shadow-[0_0_60px_rgba(126,184,218,0.4)]">
        <Image
          src="/imgs/smart/smartsynk-icon-v2.png"
          alt="SmartSynk"
          width={64}
          height={64}
          className="h-14 w-14 object-contain"
        />
      </div>
      {/* Light beams */}
      <div className="absolute inset-0 overflow-hidden rounded-full opacity-30">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-accent/0 via-accent/50 to-accent/0" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0" />
      </div>
    </div>
  );
}
