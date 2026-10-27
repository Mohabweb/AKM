import Link from "next/link";
import { getSettings, str } from "@/lib/catalog";

export async function AnnouncementBar() {
  const s = await getSettings();
  const text = str(s, "announcement_text");
  if (s.announcement_enabled !== true || !text) return null;
  const href = str(s, "announcement_href");
  const inner = <span className="font-medium">{text}</span>;
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs text-sand sm:text-sm">
      {href ? <Link href={href} className="underline-offset-4 hover:underline">{inner}</Link> : inner}
    </div>
  );
}
