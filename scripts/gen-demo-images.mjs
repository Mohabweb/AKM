// Generates clearly-labelled placeholder images for the 6 demo products (public/demo/*.webp). Not product photography.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
const items = ["demo-sneaker-1", "demo-sneaker-2", "demo-slide-3", "demo-boot-4", "demo-flat-5", "demo-runner-6"];
mkdirSync("public/demo", { recursive: true });
for (const slug of items) for (const [suffix, bg, fg] of [["a", "#E8E1D4", "#0B6C78"], ["b", "#CFE9EC", "#0B1F23"]]) {
  const name = slug.replace("demo-", "").replace(/-/g, " ").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="${bg}"/>
  <path d="M120 640 C220 640 260 520 360 520 L520 600 C620 640 700 640 700 720 L700 760 L120 760 Z" fill="${fg}" opacity=".85"/>
  <text x="400" y="330" font-family="Georgia,serif" font-size="96" text-anchor="middle" fill="${fg}">DEMO</text>
  <text x="400" y="400" font-family="Arial,sans-serif" font-size="34" letter-spacing="6" text-anchor="middle" fill="${fg}">${name}</text>
  <text x="400" y="900" font-family="Arial,sans-serif" font-size="26" text-anchor="middle" fill="${fg}" opacity=".7">placeholder image — not a real product</text></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(`public/demo/${slug}-${suffix}.webp`);
}
console.log("done");
