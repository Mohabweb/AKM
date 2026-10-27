/** General fitting advice only. Brand-specific charts are not invented here: the owner can add them to the product description. */
export function SizeGuide() {
  const rows: [string, string][] = [["36", "22.5"], ["37", "23.5"], ["38", "24"], ["39", "25"], ["40", "25.5"], ["41", "26.5"], ["42", "27"], ["43", "28"], ["44", "28.5"], ["45", "29.5"]];
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>How to measure your foot</h3>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Stand on a sheet of paper with your heel against a wall.</li>
        <li>Mark the tip of your longest toe and measure from the wall to the mark.</li>
        <li>Measure both feet and use the longer one. Measure in the evening, when feet are largest.</li>
      </ol>
      <table className="w-full max-w-sm border-collapse text-left">
        <caption className="mb-2 text-left text-xs text-muted">Approximate EU size to foot length. Fit varies by brand and style.</caption>
        <thead><tr className="border-b border-ink/20"><th className="py-2 pr-4">EU size</th><th>Foot length (cm)</th></tr></thead>
        <tbody>{rows.map(([s, c]) => <tr key={s} className="border-b border-ink/10"><td className="tabular py-1.5">{s}</td><td className="tabular">{c}</td></tr>)}</tbody>
      </table>
      <p className="text-muted">Between two sizes? Contact us on WhatsApp or Instagram before ordering and we will help you choose.</p>
    </div>
  );
}
