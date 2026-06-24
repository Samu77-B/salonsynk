import Link from "next/link";
import { NAIL_SITE } from "@core/config/nail-site";

export default function NailOnboardingPage() {
  return (
    <div className="nail-marketing min-h-screen bg-canvas text-foreground flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Welcome to {NAIL_SITE.name}</h1>
        <p className="text-muted text-sm">
          Your nail bar account is not linked yet. Ask your salon owner or contact us at{" "}
          <a href={`mailto:${NAIL_SITE.email}`} className="text-accent hover:underline">
            {NAIL_SITE.email}
          </a>{" "}
          to get access.
        </p>
        <p className="text-muted text-sm">
          New nail bars are set up by our team — you will receive login details once your salon is
          provisioned.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
