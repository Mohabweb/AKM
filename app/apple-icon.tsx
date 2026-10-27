import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
/** Placeholder until the official retro AKM logo file is supplied: white AKM on brand teal. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1395A4", color: "#fff", fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>AKM</div>,
    size,
  );
}
