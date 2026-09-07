import { requireSalonFeature } from "@/lib/salon-features.server";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";
import { ProductsView, type ProductRow } from "./products-view";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { context } = await requireSalonFeature("products_shop");

  const supabase = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, context.member.role ?? "")) redirect("/dashboard");
  const canManage = context.member.role === "owner" || isSuperAdmin;

  const productsQuery = async () => {
    const PRODUCT_COLS =
      "id, name, description, category, price_minor, currency, is_active, sort_order, image_url";
    const VARIANT_EMBED = "product_variants(id, color, size, stock_quantity, image_url, sort_order)";
    const withAll = await supabase
      .from("products")
      .select(`${PRODUCT_COLS}, product_services(service_id), ${VARIANT_EMBED}`)
      .eq("salon_id", context.salon.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!withAll.error) return { ...withAll, productServicesAvailable: true, variantsAvailable: true };

    const withLinks = await supabase
      .from("products")
      .select(`${PRODUCT_COLS}, product_services(service_id)`)
      .eq("salon_id", context.salon.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!withLinks.error) return { ...withLinks, productServicesAvailable: true, variantsAvailable: false };

    const fallback = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("salon_id", context.salon.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    return { ...fallback, productServicesAvailable: false, variantsAvailable: false };
  };

  const [{ data: svcRows }, productsRes] = await Promise.all([
    supabase.from("services").select("id, name").eq("salon_id", context.salon.id).order("name"),
    productsQuery(),
  ]);
  const { data: rows, error, productServicesAvailable, variantsAvailable } = productsRes;

  const servicesForLinks = (svcRows ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "Service",
  }));

  const products: ProductRow[] = error
    ? []
    : (rows ?? []).map((r) => {
        const row = r as {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          price_minor: number | null;
          currency: string | null;
          is_active: boolean | null;
          sort_order: number | null;
          image_url: string | null;
          product_services?: { service_id: string }[] | null;
          product_variants?: {
            id: string;
            color: string | null;
            size: string | null;
            stock_quantity: number | null;
            image_url: string | null;
            sort_order: number | null;
          }[] | null;
        };
        const linked =
          row.product_services?.map((x) => x.service_id).filter((id): id is string => typeof id === "string") ?? [];
        const variants = (row.product_variants ?? [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((v) => ({
            id: v.id,
            color: v.color ?? "",
            size: v.size ?? "",
            stock_quantity: v.stock_quantity ?? 0,
            image_url: v.image_url,
            sort_order: v.sort_order ?? 0,
          }));
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          price_minor: row.price_minor ?? 0,
          currency: row.currency ?? "gbp",
          is_active: row.is_active ?? true,
          sort_order: row.sort_order ?? 0,
          image_url: row.image_url,
          linked_service_ids: linked,
          variants,
        };
      });

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold">Products</h1>
      {error && (
        <p className="mb-4 text-sm text-amber-400" role="alert">
          Could not load products. If you just added this feature, run the latest Supabase migration (products
          table).
        </p>
      )}
      {!error && !productServicesAvailable && (
        <p className="mb-4 text-sm text-amber-400" role="alert">
          Product → service linking is unavailable until migration 037 (product_services) runs on Supabase. Other
          product fields still work.
        </p>
      )}
      {!error && !variantsAvailable && (
        <p className="mb-4 text-sm text-amber-400" role="alert">
          Colour, size, and stock options need migration 058 (product_variants) on Supabase. You can still add name,
          photo, and price.
        </p>
      )}
      <ProductsView
        salonId={context.salon.id}
        salonSlug={context.salon.slug}
        canManage={canManage}
        products={products}
        servicesForLinks={productServicesAvailable ? servicesForLinks : []}
      />
    </main>
  );
}
