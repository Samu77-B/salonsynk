import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/imgs/barber/favicon.png",
  },
};

export default function BarberRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
