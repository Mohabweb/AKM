"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(admin)/admin/actions";

type NavItem = {
  label: string;
  href: string;
  ownerOnly?: boolean;
  badge?: number;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Brands", href: "/admin/brands" },
  { label: "Homepage", href: "/admin/homepage" },
  { label: "Announcement", href: "/admin/announcement" },
  { label: "Shipping Fees", href: "/admin/shipping" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Staff Accounts", href: "/admin/staff", ownerOnly: true },
  { label: "Audit Log", href: "/admin/audit", ownerOnly: true },
];

export function AdminNav({
  admin,
  pendingReceiptsCount = 0,
}: {
  admin: { email: string; role: "owner" | "staff" };
  pendingReceiptsCount?: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isCurrent = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.ownerOnly || admin.role === "owner");

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Role Badge */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              aria-label="Toggle Navigation Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-black tracking-tight text-[#0B1F23]">
                AKM
              </span>
              <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-[#0E7C89] font-bold">
                Admin
              </span>
            </Link>

            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                admin.role === "owner"
                  ? "bg-[#0E7C89]/10 text-[#0E7C89] border border-[#0E7C89]/20"
                  : "bg-neutral-100 text-neutral-700 border border-neutral-200"
              }`}
            >
              {admin.role}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1 overflow-x-auto py-1">
            {visibleItems.map((item) => {
              const active = isCurrent(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-[#0E7C89] text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.href === "/admin/orders" && pendingReceiptsCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-400 text-amber-950 rounded-full text-[10px] font-black">
                      {pendingReceiptsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Store Link & User Profile / Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-neutral-600 hover:text-[#0E7C89] px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-[#0E7C89] transition-all flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">Storefront</span>
            </Link>

            <span className="hidden md:inline-block text-xs text-neutral-500 font-mono max-w-[150px] truncate" title={admin.email}>
              {admin.email}
            </span>

            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-red-700 font-medium border border-neutral-200 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-neutral-200 py-3 space-y-1">
            <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-100 mb-1">
              Signed in as: <strong className="text-neutral-800">{admin.email}</strong> ({admin.role})
            </div>
            {visibleItems.map((item) => {
              const active = isCurrent(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                    active
                      ? "bg-[#0E7C89] text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.href === "/admin/orders" && pendingReceiptsCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-400 text-amber-950 rounded-full text-xs font-black">
                      {pendingReceiptsCount} pending
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
