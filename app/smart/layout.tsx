import type { Metadata } from "next";
import { SMART_JSON_LD } from "@core/config/smart-site";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/smart/favicon-v2.png",
    shortcut: "/imgs/smart/favicon-v2.png",
    apple: "/imgs/smart/favicon-v2.png",
  },
};

export default function SmartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SMART_JSON_LD) }}
      />
      {children}
    </>
  );
}
