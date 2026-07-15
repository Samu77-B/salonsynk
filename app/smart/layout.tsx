import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/smart/favicon-v1.png",
    shortcut: "/imgs/smart/favicon-v1.png",
    apple: "/imgs/smart/favicon-v1.png",
  },
};

export default function SmartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
