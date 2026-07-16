import Link from "next/link";
import { SMART_SITE } from "@core/config/smart-site";
/* eslint-disable @next/next/no-img-element */

type SmartSynkLogoProps = {
  /** header: nav bar · centered: login/signup · footer · sidebar: dashboard */
  variant?: "header" | "centered" | "footer" | "sidebar";
  href?: string;
  className?: string;
};

/** SmartSynk logo at 80% of previous sizes (20% reduction). */
export function SmartSynkLogo({ variant = "header", href = "/", className = "" }: SmartSynkLogoProps) {
  const iconClass =
    variant === "centered"
      ? "mx-auto h-[38px] w-auto object-contain md:hidden"
      : variant === "footer"
        ? "h-8 w-auto object-contain max-w-none"
        : variant === "sidebar"
          ? "h-[26px] w-auto object-contain"
          : "h-8 w-auto object-contain md:hidden";

  const logoClass =
    variant === "centered"
      ? "mx-auto hidden h-[38px] w-auto object-contain md:block sm:h-11"
      : variant === "footer"
        ? "h-8 w-auto object-contain max-w-none"
        : variant === "sidebar"
          ? "h-[26px] w-auto object-contain"
          : "hidden h-[38px] w-auto object-contain md:block sm:h-11";

  const content = (
    <>
      <img src={SMART_SITE.icon} alt={SMART_SITE.name} className={iconClass} />
      <img src={SMART_SITE.logo} alt={SMART_SITE.name} className={logoClass} />
    </>
  );

  if (variant === "footer") {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <img src={SMART_SITE.logoWht} alt={SMART_SITE.name} className={logoClass} />
      </span>
    );
  }

  if (variant === "sidebar") {
    const logo = (
      <img src={SMART_SITE.logoWht} alt={SMART_SITE.name} className={logoClass} />
    );
    if (href) {
      return (
        <Link href={href} className={`inline-flex items-center shrink-0 min-w-0 ${className}`}>
          {logo}
        </Link>
      );
    }
    return <span className={`inline-flex items-center ${className}`}>{logo}</span>;
  }

  return (
    <Link href={href} className={`inline-flex items-center shrink-0 min-w-0 ${className}`}>
      {content}
    </Link>
  );
}
