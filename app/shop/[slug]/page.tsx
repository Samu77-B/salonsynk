import { SalonPublicShop } from "@/components/salon-shop/salon-public-shop";

export default async function ShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SalonPublicShop slug={slug} />;
}
