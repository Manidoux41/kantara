import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/public/brand-mark";

const size = { width: 1200, height: 630 };

export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#e4f2fc", color: "#17334d", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: "18px solid #f3cf63" }}>
      <div style={{ display: "flex", width: 140, height: 140, padding: 18, borderRadius: 70, background: "#fff3c9", color: "#215e87" }}><BrandMark /></div>
      <div style={{ display: "flex", fontSize: 84, letterSpacing: 14, marginTop: 26 }}>KANTARA</div>
      <div style={{ display: "flex", fontSize: 28, marginTop: 26 }}>PROPERTY SERVICES · CAMBODIA</div>
      <div style={{ display: "flex", fontSize: 18, color: "#4b6173", marginTop: 36 }}>DEMONSTRATION · FICTIONAL LISTINGS</div>
    </div>, size,
  );
}
