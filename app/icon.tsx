import { VibinAppIconMark } from "@/components/VibinAppIconMark";
import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    {
      id: "32",
      size: { width: 32, height: 32 },
      contentType: "image/png",
      alt: "vibin.click",
    },
    {
      id: "192",
      size: { width: 192, height: 192 },
      contentType: "image/png",
      alt: "vibin.click",
    },
    {
      id: "512",
      size: { width: 512, height: 512 },
      contentType: "image/png",
      alt: "vibin.click",
    },
  ];
}

export default async function Icon({
  id,
}: {
  id: Promise<string | number>;
}) {
  const iconId = String(await id);
  const size =
    iconId === "192" ? 192 : iconId === "512" ? 512 : 32;

  return new ImageResponse(<VibinAppIconMark size={size} />, {
    width: size,
    height: size,
  });
}
