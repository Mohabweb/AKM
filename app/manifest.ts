import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "AKM Luxury Shoes", short_name: "AKM", start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: "#1395A4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
