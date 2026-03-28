import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";
import { ProductsView, type ProductRow } from "./products-view";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  const supabase = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
  const canManage = context.member.role === "owner" || isSuperAdmin;

  const { data: rows, error } = await supabase
    .from("products")
    .select("id, name, description, category, price_minor, currency, is_active, sort_order, image_url")
    .eq("salon_id", context.salon.id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

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
        };
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
      <ProductsView
        salonId={context.salon.id}
        salonSlug={context.salon.slug}
        canManage={canManage}
        products={products}
      />
    </main>
  );
}
