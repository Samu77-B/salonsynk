import type { Metadata } from "next";
import "./globals.css";
import { RegisterSw } from "./register-sw";

export const metadata: Metadata = {
  title: "SalonSynk — No commissions. Just Synk.",
  description:
    "Flat-fee salon management for UK salons and barbers. Diary, team, clients, payments. No commissions.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans bg-background text-foreground">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
