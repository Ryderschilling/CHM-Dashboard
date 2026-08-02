"use client";

/** Screen-only toolbar on a print page. Hidden by @media print. */
export function PrintBar({ back, hint }: { back: string; hint: string }) {
  return (
    <div className="printbar">
      <a href={back}>Back</a>
      <span className="printbar-hint">{hint}</span>
      <button className="go" onClick={() => window.print()}>
        Save as PDF
      </button>
    </div>
  );
}
