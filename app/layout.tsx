import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { RegisterSw } from "./register-sw";
import { AuthHashHandler } from "@/components/auth/auth-hash-handler";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SalonSynk — No commissions. Just Synk.",
  description:
    "Flat-fee salon management for salons and barbers. Diary, team, clients, payments. No commissions.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body className="min-h-screen font-sans bg-canvas text-foreground overflow-x-hidden">
        <RegisterSw />
        <AuthHashHandler />
        {children}
      </body>
    </html>
  );
}
