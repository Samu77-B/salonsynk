import { createAdminClient } from "@/lib/supabase/admin";
import { formatProductPriceMinor } from "@/lib/product-currency";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBuyButton } from "./product-buy-button";

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
    .select("id, name, slug, settings")
    .eq("slug", slug)
    .single();

  if (!salon) notFound();

  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, description, category, price_minor, currency, image_url, sort_order")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const products = productRows ?? [];

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};
  const displayName = (branding.company_name?.trim() || salon.name) as string;
  const primaryColor = branding.primary_color?.trim();
  const logoUrl = branding.logo_url?.trim();

  return (
    <main
      className="animate-entry-up min-h-screen px-4 py-6 sm:p-8"
      style={
        primaryColor ? ({ ["--accent"]: primaryColor } as React.CSSProperties) : undefined
      }
    >
      <div className="mx-auto max-w-3xl space-y-8">
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
            {products.map((p) => {
              const row = p as {
                id: string;
                name: string;
                description: string | null;
                category: string | null;
                price_minor: number | null;
                currency: string | null;
                image_url: string | null;
              };
              const minor = row.price_minor ?? 0;
              const cur = row.currency ?? "gbp";
              return (
                <li
                  key={row.id}
                  id={`product-${row.id}`}
                  className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-background/80 shadow-sm"
                >
                  <div className="aspect-[4/3] w-full bg-muted/30">
                    {row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">No image</div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    {row.category && (
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">{row.category}</p>
                    )}
                    <h2 className="text-lg font-semibold text-foreground">{row.name}</h2>
                    <p className="text-base font-medium text-accent">
                      {formatProductPriceMinor(minor, cur)}
                    </p>
                    {row.description && (
                      <p className="text-sm text-muted whitespace-pre-wrap">{row.description}</p>
                    )}
                    <ProductBuyButton
                      slug={slug}
                      productId={row.id}
                      productName={row.name}
                      priceLabel={formatProductPriceMinor(minor, cur)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="border-t border-border pt-6 text-center text-xs text-muted">
          <p>Pay online where available; prices may vary in salon. Contact {displayName} with questions.</p>
        </footer>
      </div>
    </main>
  );
}
