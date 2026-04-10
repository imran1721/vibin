import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { AnalyticsSession } from "@/components/AnalyticsSession";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SplashScreen } from "@/components/SplashScreen";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "vibin.click — YouTube watch party & synced rooms",
    template: "%s | vibin.click",
  },
  description:
    "Host a free YouTube watch party in your browser: everyone stays in sync—no login, no app install. Share a link, queue videos together, chat and react in real time.",
  keywords: [
    "YouTube watch party",
    "watch YouTube together",
    "sync YouTube playback",
    "group YouTube",
    "watch party app",
    "YouTube listening party",
    "shared YouTube queue",
  ],
  authors: [{ name: "vibin.click" }],
  creator: "vibin.click",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "vibin.click",
    title: "vibin.click — YouTube watch party in your browser",
    description:
      "Free synchronized YouTube watch parties: one link, real-time sync, shared queue. Works on phone and desktop.",
  },
  twitter: {
    card: "summary",
    title: "vibin.click — YouTube watch party",
    description:
      "Watch YouTube in sync with friends. No login—share a link and start a room.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon/32", sizes: "32x32", type: "image/png" },
      { url: "/icon/192", sizes: "192x192", type: "image/png" },
      { url: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "vibin.click",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1c1412" },
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col font-sans">
        <AnalyticsSession />
        <ServiceWorkerRegistration />
        <SplashScreen>{children}</SplashScreen>
      </body>
    </html>
  );
}
