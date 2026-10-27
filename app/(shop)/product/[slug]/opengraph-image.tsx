import { ImageResponse } from "next/og";
import { getProduct } from "@/lib/catalog";
import { formatEGP } from "@/lib/money";
import { abs, SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Product image";

/** Branded share card: product photo (if it is an absolute https URL or a site path), name, brand and the DB price. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  const img = p?.images[0]?.url;
  const src = img ? (img.startsWith("http") ? img : abs(img)) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(180deg,#1583dc,#7cc4f5)", padding: 48, gap: 48, color: "#fff" }}>
        <div style={{ width: 460, height: 534, display: "flex", borderRadius: 32, overflow: "hidden", background: "#e8e1d4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="" width={460} height={534} style={{ objectFit: "cover" }} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, textTransform: "uppercase" }}>{SITE_NAME}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p?.brand_name && <div style={{ display: "flex", fontSize: 32, opacity: 0.9 }}>{p.brand_name}</div>}
            <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 8 }}>{p?.name ?? SITE_NAME}</div>
            {p && <div style={{ display: "flex", marginTop: 24, alignSelf: "flex-start", background: "#d4fb52", color: "#0b1f23", fontSize: 40, fontWeight: 700, padding: "10px 28px", borderRadius: 999 }}>{formatEGP(p.price_piasters)}</div>}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
