import Image from "next/image";
/** Stand-in AKM wordmark (Gloock, from public/logo.svg). Replace public/logo.svg with the official retro wordmark file. */
export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  return <Image src="/logo.svg" alt="AKM Luxury Shoes" width={252} height={128} priority className={className} unoptimized />;
}
