import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/smart/favicon-v2.png",
    shortcut: "/imgs/smart/favicon-v2.png",
    apple: "/imgs/smart/favicon-v2.png",
  },
};

export default function SmartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
