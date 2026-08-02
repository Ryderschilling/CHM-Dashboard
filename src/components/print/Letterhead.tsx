import { CHM } from "@/lib/brand";

/**
 * Typographic letterhead. Deliberately no image asset: the dashboard's logo is
 * a white mark on transparent, which disappears on white paper. This matches
 * the public site header exactly (black tile + letterspaced wordmark) and
 * prints crisply at any size.
 */
export default function Letterhead({ docType }: { docType: string }) {
  return (
    <div className="brandbar">
      <div className="brand">
        <span className="brand-mark">CHM</span>
        <div>
          <div className="brand-name">Coastal Home Management</div>
          <div className="brand-sub">{docType}</div>
        </div>
      </div>
      <div className="brand-contact">
        {CHM.phoneDisplay}
        <br />
        {CHM.email}
        <br />
        {CHM.site}
      </div>
    </div>
  );
}
