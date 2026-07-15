import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/barber/favicon-v2.png",
    shortcut: "/imgs/barber/favicon-v2.png",
    apple: "/imgs/barber/favicon-v2.png",
  },
};

export default function BarberRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
