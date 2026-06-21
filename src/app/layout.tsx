import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuditKosh — Find forgotten subscriptions without giving up your bank login",
  description:
    "Drop your bank statement CSV and find recurring charges, sneaky price hikes, and forgotten subscriptions. 100% in your browser. No accounts, no Plaid, no server. Turn your Wi-Fi off and watch it still work.",
  keywords: [
    "subscription tracker",
    "cancel subscriptions",
    "bank statement analyzer",
    "privacy",
    "no plaid",
    "recurring charges",
  ],
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#060a09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
