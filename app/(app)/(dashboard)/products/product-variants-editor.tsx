"use client";

import { useState, type ChangeEvent } from "react";
import { uploadProductImage } from "./actions";
import {
  DEFAULT_SIZE_PRESETS,
  PRODUCT_OPTION_MAX,
  uniqueOptions,
  variantKey,
  type VariantDraft,
} from "@/lib/product-variants";

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm w-full min-w-0 placeholder:text-muted-foreground/60";

function addOption(list: string[], raw: string): string[] {
  const next = uniqueOptions([...list, raw]);
  return next;
}

function removeOption(list: string[], value: string): string[] {
  const want = value.trim().toLowerCase();
  return list.filter((x) => x.trim().toLowerCase() !== want);
}

function ColorPhotoUpload({
  salonId,
  idPrefix,
  color,
  imageUrl,
  onImageUrlChange,
}: {
  salonId: string;
  idPrefix: string;
  color: string;
  imageUrl: string;
  onImageUrlChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploadErr("");
    setUploading(true);
    const fd = new FormData();
    fd.set("image", f);
    const r = await uploadProductImage(salonId, fd);
    setUploading(false);
    if (r.error) setUploadErr(r.error);
    else if (r.url) onImageUrlChange(r.url);
  }

  const inputId = `${idPrefix}-color-photo-${color.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-10 w-10 rounded-md border border-border object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted">
          Photo
        </span>
      )}
      <label htmlFor={inputId} className="cursor-pointer text-xs text-accent underline">
        {uploading ? "Uploading…" : imageUrl ? "Change" : "Upload"}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => void onFileChange(e)}
      />
      {uploadErr ? (
        <span className="text-xs text-red-400" role="alert">
          {uploadErr}
        </span>
      ) : null}
    </div>
  );
}

function OptionChips({
  label,
  values,
  placeholder,
  onAdd,
  onRemove,
  presets,
}: {
  label: string;
  values: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  presets?: readonly string[];
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  }

  return (
    <div>
      <p className="mb-1 block text-sm font-medium">{label}</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v.toLowerCase()}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              className="text-muted hover:text-foreground"
              aria-label={`Remove ${v}`}
              onClick={() => onRemove(v)}
            >
              ×
            </button>
          </span>
        ))}
        {values.length === 0 ? <span className="text-xs text-muted">None yet</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, PRODUCT_OPTION_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className={`${inputClass} max-w-xs`}
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          Add
        </button>
        {presets?.map((p) =>
          values.some((v) => v.toLowerCase() === p.toLowerCase()) ? null : (
            <button
              key={p}
              type="button"
              onClick={() => onAdd(p)}
              className="rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              + {p}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export function ProductVariantsEditor({
  salonId,
  idPrefix,
  value,
  onChange,
}: {
  salonId: string;
  idPrefix: string;
  value: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const colors = uniqueOptions(value.colors);
  const sizes = uniqueOptions(value.sizes);
  const showGrid = colors.length > 0 || sizes.length > 0;
  const colorList = colors.length > 0 ? colors : [""];
  const sizeList = sizes.length > 0 ? sizes : [""];

  function setQty(color: string, size: string, qty: string) {
    const key = variantKey(color, size);
    onChange({
      ...value,
      qtyByKey: { ...value.qtyByKey, [key]: qty },
    });
  }

  return (
    <fieldset className="space-y-4 rounded-lg border border-border bg-background/40 p-3">
      <legend className="px-1 text-sm font-medium">Colours, sizes & stock</legend>
      <p className="text-xs text-muted">
        Leave this blank for a simple item (shampoo, etc.). For a t-shirt, add colours and sizes, then type how many you
        have in each box. Leave a box empty if you do not sell that combo.
      </p>

      <OptionChips
        label="Colours"
        values={colors}
        placeholder="e.g. Red"
        onAdd={(raw) => onChange({ ...value, colors: addOption(value.colors, raw) })}
        onRemove={(v) => {
          const nextColors = removeOption(value.colors, v);
          const want = v.trim().toLowerCase();
          const qtyByKey = { ...value.qtyByKey };
          for (const key of Object.keys(qtyByKey)) {
            if (key.startsWith(`${want}\0`)) delete qtyByKey[key];
          }
          const colorImages = { ...value.colorImages };
          delete colorImages[want];
          onChange({ ...value, colors: nextColors, qtyByKey, colorImages });
        }}
      />

      <OptionChips
        label="Sizes"
        values={sizes}
        placeholder="e.g. Medium"
        presets={DEFAULT_SIZE_PRESETS}
        onAdd={(raw) => onChange({ ...value, sizes: addOption(value.sizes, raw) })}
        onRemove={(v) => {
          const nextSizes = removeOption(value.sizes, v);
          const want = v.trim().toLowerCase();
          const qtyByKey = { ...value.qtyByKey };
          for (const key of Object.keys(qtyByKey)) {
            if (key.endsWith(`\0${want}`)) delete qtyByKey[key];
          }
          onChange({ ...value, sizes: nextSizes, qtyByKey });
        }}
      />

      {colors.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Photo per colour (optional)</p>
          <p className="mb-2 text-xs text-muted">
            Upload a red photo and a green photo — they apply to every size of that colour.
          </p>
          <ul className="space-y-2">
            {colors.map((c) => (
              <li key={c.toLowerCase()} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm">{c}</span>
                <ColorPhotoUpload
                  salonId={salonId}
                  idPrefix={idPrefix}
                  color={c}
                  imageUrl={value.colorImages[c.toLowerCase()] ?? ""}
                  onImageUrlChange={(url) =>
                    onChange({
                      ...value,
                      colorImages: { ...value.colorImages, [c.toLowerCase()]: url },
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showGrid ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">
                  {colors.length && sizes.length ? "Colour \\ Size" : colors.length ? "Colour" : "Size"}
                </th>
                {sizeList.map((s, i) => (
                  <th key={s || `col-${i}`} className="border-b border-border px-2 py-1.5 text-left font-medium">
                    {s || "Qty"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colorList.map((c, ri) => (
                <tr key={c || `row-${ri}`}>
                  <td className="border-b border-border px-2 py-1.5 whitespace-nowrap">{c || "Qty"}</td>
                  {sizeList.map((s, ci) => {
                    const key = variantKey(c, s);
                    return (
                      <td key={`${key}-${ci}`} className="border-b border-border px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={value.qtyByKey[key] ?? ""}
                          onChange={(e) => setQty(c, s, e.target.value)}
                          placeholder="—"
                          aria-label={`Stock for ${c || "item"} ${s}`.trim()}
                          className={`${inputClass} w-20`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <label htmlFor={`${idPrefix}-stock-only`} className="mb-1 block text-sm font-medium">
            Quantity in stock (optional)
          </label>
          <input
            id={`${idPrefix}-stock-only`}
            type="number"
            min={0}
            inputMode="numeric"
            value={value.stockOnlyQty}
            onChange={(e) => onChange({ ...value, stockOnlyQty: e.target.value })}
            placeholder="Leave blank to skip stock tracking"
            className={`${inputClass} max-w-[12rem]`}
          />
        </div>
      )}
    </fieldset>
  );
}
