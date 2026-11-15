import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Telegram Focus — Plan • Focus • Achieve",
  description:
    "A minimalist communication layer over Telegram eliminating feeds, search engines, recommendations, and unnecessary social distraction.",
  manifest: "/manifest.json",
  icons: {
    icon: "/app-icon.png",
    shortcut: "/app-icon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Focus",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAFAF9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-stone-100 flex flex-col">{children}</body>
    </html>
  );
}
