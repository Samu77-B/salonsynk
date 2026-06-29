import Link from "next/link";
import { SMART_SITE } from "@core/config/smart-site";

type SmartSynkLoginBannerProps = {
  from: "salon" | "barber" | "nail";
};

export function SmartSynkLoginBanner({ from }: SmartSynkLoginBannerProps) {
  const loginHref =
    process.env.NODE_ENV === "development"
      ? `/smart/login?from=${from}`
      : `${SMART_SITE.url}/login?from=${from}`;

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm">
      <p className="text-muted">
        Sign in via{" "}
        <Link href={loginHref} className="font-medium text-accent hover:underline">
          {SMART_SITE.name}
        </Link>{" "}
        for unified access across all platforms.
      </p>
    </div>
  );
}
