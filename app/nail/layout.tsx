import type { Metadata } from "next";
import { NAIL_SITE } from "@core/config/nail-site";

export const metadata: Metadata = {
  title: NAIL_SITE.name,
  description: NAIL_SITE.description,
  icons: {
    icon: "/imgs/nail/favicon-v2.png",
    shortcut: "/imgs/nail/favicon-v2.png",
    apple: "/imgs/nail/favicon-v2.png",
  },
};

export default function NailRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
