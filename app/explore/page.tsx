import type { Metadata } from "next";
import { ExploreClient } from "@/components/ExploreClient";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Explore live YouTube watch parties — vibin.click",
  description:
    "Browse public rooms with people watching YouTube together right now. Tap any room to drop in as a guest.",
  alternates: {
    canonical: `${getSiteUrl()}/explore`,
  },
  openGraph: {
    title: "Explore live YouTube watch parties — vibin.click",
    description:
      "Drop into a public watch party in one tap. Real-time playback, shared queue, no account required.",
    url: `${getSiteUrl()}/explore`,
  },
};

export default function ExplorePage() {
  return <ExploreClient />;
}
