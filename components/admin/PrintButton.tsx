"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-5 py-2.5 rounded-xl bg-[#0E7C89] text-white font-bold text-sm shadow-sm hover:bg-[#0b646f] transition-colors flex items-center gap-1.5 print:hidden"
    >
      <span>🖨️</span>
      <span>{label}</span>
    </button>
  );
}
