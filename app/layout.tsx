import type { Metadata } from "next";
import { Chewy, Quicksand } from "next/font/google";
import "./globals.css";

// Bouncy, candy-like cursive for the Starboard wordmark
const chewy = Chewy({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-logo",
  display: "swap",
});

// Clean, friendly body face for everything else
const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Starboard — let's untangle those to-dos",
  description:
    "A whimsical, AI-powered to-do list. Dump your messy brain, and Starboard sorts it out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chewy.variable} ${quicksand.variable}`}>
      <body className="bg-dash-bg">{children}</body>
    </html>
  );
}
