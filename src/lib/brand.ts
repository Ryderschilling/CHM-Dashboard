/**
 * Identity used on printed documents. Keep in step with the public site's
 * src/data/siteData.ts. If the phone or email changes, change it here too.
 */
export const CHM = {
  name: "Coastal Home Management 30A",
  phoneDisplay: "(309) 415-8793",
  email: "coastalhomemanagement30a@gmail.com",
  site: "coastalhomemngt30a.com",
  owner: "Ryder Schilling",
  ownerRole: "Owner, Coastal Home Management 30A",
  area: "Watersound Origins · Naturewalk · Inlet Beach · Scenic 30A",
} as const;

/**
 * THE LEGAL LINE. This text must appear on every document that touches
 * insurance, claims, or documentation. It is the same string as the public
 * site's src/data/protection.ts LEGAL_DISCLAIMER. Do not soften it and do not
 * drop it off a document. Read the rule in CLAUDE.md before editing.
 */
export const LEGAL_DISCLAIMER =
  "Coastal Home Management 30A provides property visit and documentation services. We are not home inspectors, insurance agents, or adjusters, and nothing here is a home inspection, an insurance recommendation, or advice about your coverage. Our reports document observations on the dates listed. Policy terms differ by carrier. For questions about your policy, coverage, or a claim, contact your insurance agent.";
