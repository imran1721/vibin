import { getSiteUrl } from "@/lib/site-url";

/**
 * WebSite + WebApplication structured data for the homepage (helps rich results / discovery).
 */
export function HomeJsonLd() {
  const url = getSiteUrl();
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: "vibin.click",
        description:
          "Free YouTube watch party app: sync playback with friends in the browser. No login required—share a link and queue together.",
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name: "vibin.click",
        url,
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Any (web browser)",
        browserRequirements: "Requires JavaScript",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description:
          "Host or join a synchronized YouTube watch party from your phone or desktop. Real-time sync, shared queue, chat, and reactions.",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
