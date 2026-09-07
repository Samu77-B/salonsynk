"use client";

import { useMemo, useState } from "react";
import {
  formatVariantLabel,
  hasOptionVariants,
  isStockOnlyVariants,
  uniqueOptions,
  type ProductVariantRow,
} from "@/lib/product-variants";

export type CheckoutProduct = {
  id: string;
  name: string;
  price_minor: number;
  linkedServiceIds: string[];
  variants: ProductVariantRow[];
};

function OptionButtons({
  label,
  values,
  selected,
  onSelect,
  disabledValues,
}: {
  label: string;
  values: string[];
  selected: string;
  onSelect: (v: string) => void;
  disabledValues?: Set<string>;
}) {
  if (values.length === 0) return null;
  return (
    <div className="mt-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {values.map((v) => {
          const disabled = disabledValues?.has(v.toLowerCase());
          const active = selected.toLowerCase() === v.toLowerCase();
          return (
            <button
              key={v.toLowerCase()}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(v)}
              className={`rounded-md border px-2 py-0.5 text-xs ${
                active
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border text-foreground hover:bg-muted/30"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VariantProductPick({
  product,
  selectedVariantIds,
  onChange,
}: {
  product: CheckoutProduct;
  selectedVariantIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const variants = product.variants;
  const colors = uniqueOptions(variants.map((v) => v.color));
  const sizes = uniqueOptions(variants.map((v) => v.size));
  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState("");

  const sizesForColor = useMemo(() => {
    if (!colors.length) return sizes;
    const want = color.trim().toLowerCase();
    return uniqueOptions(
      variants.filter((v) => v.color.trim().toLowerCase() === want).map((v) => v.size)
    );
  }, [variants, colors.length, color, sizes]);

  const match = variants.find((v) => {
    const cOk = !colors.length || v.color.trim().toLowerCase() === color.trim().toLowerCase();
    const sOk = !sizes.length || v.size.trim().toLowerCase() === size.trim().toLowerCase();
    return cOk && sOk;
  });

  const selectedHere = variants.filter((v) => selectedVariantIds.includes(v.id));

  function addCurrent() {
    if (!match || match.stock_quantity < 1) return;
    if (selectedVariantIds.includes(match.id)) return;
    onChange([...selectedVariantIds, match.id]);
  }

  function remove(id: string) {
    onChange(selectedVariantIds.filter((x) => x !== id));
  }

  const soldOut = variants.every((v) => v.stock_quantity < 1);

  return (
    <div className="rounded-lg border border-border/80 bg-background/40 px-2 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{product.name}</span>
        <span className="text-muted text-sm">£{((product.price_minor ?? 0) / 100).toFixed(2)}</span>
      </div>
      {soldOut ? (
        <p className="mt-1 text-xs text-muted">Sold out</p>
      ) : (
        <>
          <OptionButtons label="Colour" values={colors} selected={color} onSelect={(v) => { setColor(v); setSize(""); }} />
          <OptionButtons
            label="Size"
            values={sizesForColor}
            selected={size}
            onSelect={setSize}
            disabledValues={
              new Set(
                variants
                  .filter((v) => {
                    if (colors.length && v.color.trim().toLowerCase() !== color.trim().toLowerCase()) return false;
                    return v.stock_quantity < 1;
                  })
                  .map((v) => v.size.trim().toLowerCase())
              )
            }
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!match || match.stock_quantity < 1 || selectedVariantIds.includes(match.id)}
              onClick={addCurrent}
              className="rounded-md border border-border px-2 py-0.5 text-xs disabled:opacity-40"
            >
              Add to bill
            </button>
            {match ? (
              <span className="text-xs text-muted">
                {match.stock_quantity} left
              </span>
            ) : (
              <span className="text-xs text-muted">Pick colour and size</span>
            )}
          </div>
        </>
      )}
      {selectedHere.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {selectedHere.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => remove(v.id)}
                className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs"
              >
                {formatVariantLabel(v)} ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CheckoutProductPick({
  product,
  selectedProductIds,
  selectedVariantIds,
  onToggleProduct,
  onChangeVariants,
}: {
  product: CheckoutProduct;
  selectedProductIds: string[];
  selectedVariantIds: string[];
  onToggleProduct: (id: string, on: boolean) => void;
  onChangeVariants: (ids: string[]) => void;
}) {
  if (hasOptionVariants(product.variants)) {
    return (
      <VariantProductPick
        product={product}
        selectedVariantIds={selectedVariantIds}
        onChange={onChangeVariants}
      />
    );
  }

  const stockOnly = isStockOnlyVariants(product.variants);
  const stockVariant = stockOnly ? product.variants[0] : null;
  const checked = stockVariant
    ? selectedVariantIds.includes(stockVariant.id)
    : selectedProductIds.includes(product.id);
  const soldOut = Boolean(stockVariant && stockVariant.stock_quantity < 1);

  return (
    <label className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        disabled={soldOut}
        onChange={(e) => {
          if (stockVariant) {
            if (e.target.checked) onChangeVariants([...selectedVariantIds, stockVariant.id]);
            else onChangeVariants(selectedVariantIds.filter((id) => id !== stockVariant.id));
          } else {
            onToggleProduct(product.id, e.target.checked);
          }
        }}
      />
      <span>{product.name}</span>
      <span className="text-muted">£{((product.price_minor ?? 0) / 100).toFixed(2)}</span>
      {soldOut ? <span className="text-xs text-muted">Sold out</span> : null}
      {stockVariant && !soldOut ? (
        <span className="text-xs text-muted">{stockVariant.stock_quantity} left</span>
      ) : null}
    </label>
  );
}
