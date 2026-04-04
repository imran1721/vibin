import { JamAppIconMark } from "@/components/JamAppIconMark";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<JamAppIconMark size={180} />, {
    width: 180,
    height: 180,
  });
}
