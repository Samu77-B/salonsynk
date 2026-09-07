"use client";

import { useMemo, useState } from "react";
import { ProductBuyButton } from "./product-buy-button";
import { formatProductPriceMinor } from "@/lib/product-currency";
import {
  formatVariantLabel,
  hasOptionVariants,
  isStockOnlyVariants,
  uniqueOptions,
  variantImageForColor,
  type ProductVariantRow,
} from "@/lib/product-variants";

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_minor: number;
  currency: string;
  image_url: string | null;
  variants: ProductVariantRow[];
};

export function ProductShopCard({ slug, product }: { slug: string; product: ShopProduct }) {
  const variants = product.variants;
  const optioned = hasOptionVariants(variants);
  const stockOnly = isStockOnlyVariants(variants);
  const colors = uniqueOptions(variants.map((v) => v.color));
  const sizes = uniqueOptions(variants.map((v) => v.size));

  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState("");

  const sizesForColor = useMemo(() => {
    if (!colors.length) return sizes;
    const want = color.trim().toLowerCase();
    return uniqueOptions(variants.filter((v) => v.color.trim().toLowerCase() === want).map((v) => v.size));
  }, [variants, colors.length, color, sizes]);

  const match = useMemo(() => {
    if (!optioned) return stockOnly ? variants[0] ?? null : null;
    return (
      variants.find((v) => {
        const cOk = !colors.length || v.color.trim().toLowerCase() === color.trim().toLowerCase();
        const sOk = !sizes.length || v.size.trim().toLowerCase() === size.trim().toLowerCase();
        return cOk && sOk;
      }) ?? null
    );
  }, [optioned, stockOnly, variants, colors.length, sizes.length, color, size]);

  const displayImage = optioned
    ? variantImageForColor(variants, color, product.image_url)
    : product.image_url;
  const priceLabel = formatProductPriceMinor(product.price_minor, product.currency);
  const allSoldOut = variants.length > 0 && variants.every((v) => v.stock_quantity < 1);
  const selectedSoldOut = Boolean(match && match.stock_quantity < 1);
  const needsPick = optioned && (!match || (colors.length > 0 && !color) || (sizes.length > 0 && !size));
  const canBuy = !allSoldOut && !selectedSoldOut && !needsPick;

  return (
    <li
      id={`product-${product.id}`}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-background/80 shadow-sm"
    >
      <div className="aspect-[4/3] w-full bg-muted/30">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">No image</div>
        )}
      </div>
      <div className="space-y-1 p-4">
        {product.category && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{product.category}</p>
        )}
        <h2 className="text-lg font-semibold text-foreground">{product.name}</h2>
        <p className="text-base font-medium text-accent">{priceLabel}</p>
        {product.description && (
          <p className="text-sm text-muted whitespace-pre-wrap">{product.description}</p>
        )}

        {optioned && !allSoldOut ? (
          <div className="space-y-2 pt-2">
            {colors.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">Colour</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {colors.map((c) => (
                    <button
                      key={c.toLowerCase()}
                      type="button"
                      onClick={() => {
                        setColor(c);
                        setSize("");
                      }}
                      className={`rounded-md border px-2.5 py-1 text-sm ${
                        color.toLowerCase() === c.toLowerCase()
                          ? "border-accent bg-accent/15"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {sizesForColor.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">Size</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {sizesForColor.map((s) => {
                    const v = variants.find((row) => {
                      const cOk = !colors.length || row.color.trim().toLowerCase() === color.trim().toLowerCase();
                      return cOk && row.size.trim().toLowerCase() === s.toLowerCase();
                    });
                    const out = !v || v.stock_quantity < 1;
                    return (
                      <button
                        key={s.toLowerCase()}
                        type="button"
                        disabled={out}
                        onClick={() => setSize(s)}
                        className={`rounded-md border px-2.5 py-1 text-sm ${
                          size.toLowerCase() === s.toLowerCase()
                            ? "border-accent bg-accent/15"
                            : "border-border hover:bg-muted/30"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {s}
                        {v ? ` (${v.stock_quantity})` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {allSoldOut ? (
          <p className="pt-2 text-sm font-medium text-muted">Sold out</p>
        ) : stockOnly && match ? (
          <p className="text-xs text-muted">{match.stock_quantity} in stock</p>
        ) : match && optioned ? (
          <p className="text-xs text-muted">
            {formatVariantLabel(match)} · {match.stock_quantity} left
          </p>
        ) : null}

        {canBuy ? (
          <ProductBuyButton
            slug={slug}
            productId={product.id}
            variantId={match?.id}
            productName={match && optioned ? `${product.name} (${formatVariantLabel(match)})` : product.name}
            priceLabel={priceLabel}
          />
        ) : allSoldOut ? null : (
          <p className="pt-2 text-sm text-muted">Choose a colour and size to buy.</p>
        )}
      </div>
    </li>
  );
}
