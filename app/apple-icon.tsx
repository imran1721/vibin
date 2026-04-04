import { VibinAppIconMark } from "@/components/VibinAppIconMark";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<VibinAppIconMark size={180} />, {
    width: 180,
    height: 180,
  });
}
