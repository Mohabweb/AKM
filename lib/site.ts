import { publicEnv } from "@/lib/env";
export const SITE_URL = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
export const SITE_NAME = "AKM Luxury Shoes";
export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
