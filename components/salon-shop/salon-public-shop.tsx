import { createAdminClient } from "@/lib/supabase/admin";
import { Reveal } from "@/components/reveal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductShopCard } from "./product-shop-card";
import { salonRowHasFeature } from "@/lib/salon-features";

/** Public retail shop for a salon (same slug as booking). */
export async function SalonPublicShop({ slug }: { slug: string }) {
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    notFound();
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings, plan_tier, feature_overrides")
    .eq("slug", slug)
    .single();

  if (!salon) notFound();

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = (branding.company_name?.trim() || salon.name) as string;
  const primaryColor = branding.primary_color?.trim();

  if (!salonRowHasFeature(salon, "products_shop")) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center"
        style={
          primaryColor ? ({ ["--accent"]: primaryColor } as React.CSSProperties) : undefined
        }
      >
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Shop not available</h1>
          <p className="text-sm text-muted">
            {displayName} does not have an online shop enabled. Retail shop pages are included on
            the Complete plan.
          </p>
          <Link
            href={`/book/${slug}`}
            className="inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            Book an appointment
          </Link>
        </div>
      </main>
    );
  }

  const logoUrl = branding.logo_url?.trim();

  const withVariants = await supabase
    .from("products")
    .select(
      "id, name, description, category, price_minor, currency, image_url, sort_order, product_variants(id, color, size, stock_quantity, image_url, sort_order, is_active)"
    )
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const productRows = withVariants.error
    ? (
        await supabase
          .from("products")
          .select("id, name, description, category, price_minor, currency, image_url, sort_order")
          .eq("salon_id", salon.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      ).data
    : withVariants.data;

  const products = (productRows ?? []).map((p) => {
    const row = p as {
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      price_minor: number | null;
      currency: string | null;
      image_url: string | null;
      product_variants?: {
        id: string;
        color: string | null;
        size: string | null;
        stock_quantity: number | null;
        image_url: string | null;
        sort_order: number | null;
        is_active: boolean | null;
      }[] | null;
    };
    const variants = (row.product_variants ?? [])
      .filter((v) => v.is_active !== false)
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
      image_url: row.image_url,
      variants,
    };
  });

  return (
    <main
      className="min-h-screen px-4 py-6 sm:p-8"
      style={
        primaryColor ? ({ ["--accent"]: primaryColor } as React.CSSProperties) : undefined
      }
    >
      <Reveal className="mx-auto max-w-3xl space-y-8">
        <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="space-y-2">
            {logoUrl ? (
              <div className="flex justify-center sm:justify-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={displayName} className="h-12 w-auto object-contain" />
              </div>
            ) : null}
            <h1 className="text-2xl font-bold text-foreground">Shop at {displayName}</h1>
            <p className="text-sm text-muted max-w-md">
              Browse retail products. Book an appointment for services — link below.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href={`/book/${slug}`}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Book an appointment
            </Link>
            <Link href={`/book/${slug}`} className="text-sm text-muted underline">
              Back to booking
            </Link>
          </div>
        </header>

        {products.length === 0 ? (
          <p className="rounded-xl border border-border bg-background/60 p-6 text-center text-sm text-muted">
            No products listed yet. Check back soon.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
              <ProductShopCard key={p.id} slug={slug} product={p} />
            ))}
          </ul>
        )}

        <footer className="border-t border-border pt-6 text-center text-xs text-muted">
          <p>Pay online where available; prices may vary in salon. Contact {displayName} with questions.</p>
        </footer>
      </Reveal>
    </main>
  );
}
