import type { Metadata } from "next";
import "./globals.css";
import { RegisterSw } from "./register-sw";

export const metadata: Metadata = {
  title: "SalonSynk — No commissions. Just Synk.",
  description:
    "Flat-fee salon management for UK salons and barbers. Diary, team, clients, payments. No commissions.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-background text-foreground overflow-x-hidden">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
