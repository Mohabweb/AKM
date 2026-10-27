"use client";
/** Last-resort 500 (root layout failed). Inline styles only: the app stylesheet may not have loaded. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "linear-gradient(180deg,#1583dc,#7cc4f5)", fontFamily: "system-ui, sans-serif", color: "#0b1f23", textAlign: "center" }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: 32, maxWidth: 460 }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>Something went wrong on our side.</h1>
          <p style={{ color: "#586769" }}>Please try again in a moment.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#d4fb52", color: "#0b1f23", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
