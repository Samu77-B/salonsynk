import type { Metadata } from "next";
import { NAIL_SITE } from "@core/config/nail-site";

export const metadata: Metadata = {
  title: NAIL_SITE.name,
  description: NAIL_SITE.description,
  icons: {
    icon: "/imgs/nail/favicon.png",
    shortcut: "/imgs/nail/favicon.png",
    apple: "/imgs/nail/favicon.png",
  },
};

export default function NailRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
