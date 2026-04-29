import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";
import { redirect } from "next/navigation";
import { ProductsView, type ProductRow } from "./products-view";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isManagerRole(isSuperAdmin, context.member.role ?? "")) redirect("/dashboard");
  const canManage = context.member.role === "owner" || isSuperAdmin;

  const productsQuery = async () => {
    const PRODUCT_COLS =
      "id, name, description, category, price_minor, currency, is_active, sort_order, image_url";
    const withLinks = await supabase
      .from("products")
      .select(`${PRODUCT_COLS}, product_services(service_id)`)
      .eq("salon_id", context.salon.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!withLinks.error) return { ...withLinks, productServicesAvailable: true };
    const fallback = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("salon_id", context.salon.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    return { ...fallback, productServicesAvailable: false };
  };

  const [{ data: svcRows }, productsRes] = await Promise.all([
    supabase.from("services").select("id, name").eq("salon_id", context.salon.id).order("name"),
    productsQuery(),
  ]);
  const { data: rows, error, productServicesAvailable } = productsRes;

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
        };
        const linked =
          row.product_services?.map((x) => x.service_id).filter((id): id is string => typeof id === "string") ?? [];
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
