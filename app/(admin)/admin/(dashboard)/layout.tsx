import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import type { Metadata } from "next";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin — AKM Luxury Shoes",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  const sb = await sessionClient();
  const { count: pendingReceipts } = await sb
    .from("instapay_receipts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0B1F23]">
      <AdminNav admin={admin} pendingReceiptsCount={pendingReceipts || 0} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
