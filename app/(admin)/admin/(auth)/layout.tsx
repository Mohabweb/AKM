import Link from "next/link";
import type { Metadata } from "next";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin Portal — AKM Luxury Shoes",
  robots: { index: false, follow: false },
};

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 selection:bg-[#0E7C89] selection:text-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
            <span className="font-serif text-3xl font-extrabold tracking-tight text-[#0B1F23]">
              AKM
            </span>
            <span className="block text-xs uppercase tracking-widest text-[#0E7C89] font-medium mt-0.5">
              Admin Portal
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 border border-black/5 p-6 sm:p-8">
          {children}
        </div>

        <div className="text-center mt-6 text-xs text-neutral-400">
          AKM Luxury Shoes — Private Management System
        </div>
      </div>
    </div>
  );
}
