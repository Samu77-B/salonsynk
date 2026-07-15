import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/barber/favicon-v5.png",
    shortcut: "/imgs/barber/favicon-v5.png",
    apple: "/imgs/barber/favicon-v5.png",
  },
};

export default function BarberRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
