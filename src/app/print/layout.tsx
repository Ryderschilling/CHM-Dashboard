import "./print.css";

/**
 * Print shell. No sidebar, no dashboard chrome, white paper.
 *
 * Why an HTML print view instead of a PDF library: this codebase has a
 * deliberate no-extra-libraries rule, and print-to-PDF from styled HTML gives
 * better typography and exact brand fidelity than any JS PDF generator. Open
 * the page, Cmd+P, Save as PDF. The @page rules and page-break control in
 * print.css are what make it come out clean.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="paper">{children}</div>;
}
