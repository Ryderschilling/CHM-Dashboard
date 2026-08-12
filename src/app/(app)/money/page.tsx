import { redirect } from "next/navigation";

/**
 * Money folded into the Dashboard 2026-08-05. Kept as a redirect so old links,
 * bookmarks, and the Square sync callback still land somewhere sensible.
 */
export default async function MoneyMoved({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; tab?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.m) qs.set("m", sp.m);
  if (sp.tab) qs.set("tab", sp.tab);
  if (sp.new) qs.set("new", sp.new);
  redirect(qs.size ? `/?${qs}` : "/");
}
