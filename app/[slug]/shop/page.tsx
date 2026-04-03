import { permanentRedirect } from "next/navigation";

/** Legacy URL — canonical shop lives at /shop/[slug] (same pattern as /book/[slug]). */
export default async function LegacySalonShopRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/shop/${slug}`);
}
