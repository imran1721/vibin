import type { Metadata } from "next";
import { HomeJsonLd } from "@/components/HomeJsonLd";
import { VibinHome } from "@/components/VibinHome";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "YouTube watch party — free, synced, in your browser",
  description:
    "Start a YouTube watch party in one tap: everyone sees the same moment, shares one queue, and can chat and react. No account, no install—open vibin.click and share your room link.",
  alternates: {
    canonical: getSiteUrl(),
  },
  openGraph: {
    title: "YouTube watch party — vibin.click",
    description:
      "Sync YouTube with friends from any phone or browser. Free shared rooms, real-time playback, and a group queue.",
    url: getSiteUrl(),
  },
};

export default function Home() {
  return (
    <>
      <HomeJsonLd />
      <main className="vibin-page-bg flex min-h-[100dvh] w-full flex-col items-center px-[clamp(1rem,4vw,1.5rem)] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-8">
        <VibinHome />
      </main>
    </>
  );
}
