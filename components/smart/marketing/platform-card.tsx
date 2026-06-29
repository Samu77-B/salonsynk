import Link from "next/link";

type PlatformCardProps = {
  name: string;
  description: string;
  href: string;
  glowClass: string;
  icon: React.ReactNode;
  accentColor: string;
};

export function PlatformCard({
  name,
  description,
  href,
  glowClass,
  icon,
  accentColor,
}: PlatformCardProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`smart-glass group flex flex-col gap-4 rounded-xl p-6 transition-transform hover:scale-[1.02] ${glowClass}`}
      style={{ borderColor: `${accentColor}40` }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        {icon}
      </div>
      <div>
        <h3 className="font-heading text-xl font-bold">{name}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <span
        className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors group-hover:gap-2"
        style={{ color: accentColor }}
      >
        Learn more
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}

export function ScissorsIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 0a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L9.121 14.879m0 0a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243"
      />
    </svg>
  );
}

export function BarberPoleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 3v18M15 3v18M9 3h6M9 21h6M12 3v18"
      />
    </svg>
  );
}

export function NailPolishIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 4h8l1 14H7L8 4zM10 4V2h4v2M12 18v2"
      />
    </svg>
  );
}
