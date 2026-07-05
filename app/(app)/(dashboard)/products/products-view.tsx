"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  importProductsFromCsv,
} from "./actions";
import { PRODUCT_CURRENCY_OPTIONS } from "@/lib/product-currency";

const DESCRIPTION_MAX = 2000;

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_minor: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  image_url: string | null;
  /** Empty = universal at checkout; otherwise suggest when any of these services are on the bill */
  linked_service_ids: string[];
};

export type ServiceLinkOption = { id: string; name: string };

function toggleServiceId(ids: string[], id: string, on: boolean): string[] {
  if (on) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((x) => x !== id);
}

function ProductServiceLinksField({
  idPrefix,
  services,
  selectedIds,
  onToggle,
}: {
  idPrefix: string;
  services: ServiceLinkOption[];
  selectedIds: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}) {
  if (services.length === 0) {
    return (
      <p className="text-xs text-muted">
        Add services under Services to link retail items to them for checkout.
      </p>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 block text-sm font-medium">
        Checkout: show when these services are on the bill
      </legend>
      <p id={`${idPrefix}-links-hint`} className="text-xs text-muted">
        Leave all unchecked for a universal suggestion on every checkout. Tick services to surface this product mainly
        when those services appear on the bill.
      </p>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-3">
        {services.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={selectedIds.has(s.id)}
              onChange={(e) => onToggle(s.id, e.target.checked)}
            />
            <span>{s.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm w-full min-w-0 placeholder:text-muted-foreground/60";

function minorToInputAmount(minor: number) {
  return (minor / 100).toFixed(2);
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const CSV_TEMPLATE = `name,price,category,description,image_url,sort_order,is_active
Example shampoo,12.99,Hair care,Great for dry hair,,0,true
Another item,8.50,,Optional description,https://example.com/photo.jpg,1,true
`;

function CurrencySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {PRODUCT_CURRENCY_OPTIONS.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ProductImageFields({
  salonId,
  idPrefix,
  imageUrl,
  onImageUrlChange,
}: {
  salonId: string;
  idPrefix: string;
  imageUrl: string;
  onImageUrlChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-image-url`} className="mb-1 block text-sm font-medium">
        Image URL (optional)
      </label>
      <input
        id={`${idPrefix}-image-url`}
        type="url"
        value={imageUrl}
        onChange={(e) => onImageUrlChange(e.target.value)}
        placeholder="https://… or upload below"
        className={inputClass}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Upload product image file"
        onChange={(e) => void onFileChange(e)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload image"}
        </button>
        {uploadErr ? (
          <span className="text-xs text-red-400" role="alert">
            {uploadErr}
          </span>
        ) : null}
      </div>
      {imageUrl ? (
        <div className="mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-20 w-20 rounded-lg border border-border object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}

function ProductCard({
  salonId,
  salonSlug,
  servicesForLinks,
  product,
}: {
  salonId: string;
  salonSlug: string;
  servicesForLinks: ServiceLinkOption[];
  product: ProductRow;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? "");
  const [price, setPrice] = useState(product.price_minor > 0 ? minorToInputAmount(product.price_minor) : "");
  const [currency, setCurrency] = useState(product.currency || "gbp");
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [sortOrder, setSortOrder] = useState(String(product.sort_order));
  const [isActive, setIsActive] = useState(product.is_active);
  const [linkedServiceIds, setLinkedServiceIds] = useState(product.linked_service_ids);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    setName(product.name);
    setCategory(product.category ?? "");
    setPrice(product.price_minor > 0 ? minorToInputAmount(product.price_minor) : "");
    setCurrency(product.currency || "gbp");
    setDescription(product.description ?? "");
    setImageUrl(product.image_url ?? "");
    setSortOrder(String(product.sort_order));
    setIsActive(product.is_active);
    setLinkedServiceIds(product.linked_service_ids);
  }, [product]);

  async function save() {
    const n = name.trim();
    if (!n) {
      setFeedback("error");
      setFeedbackText("Name is required.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    const rawPrice = price.trim();
    const priceMinor = rawPrice ? Math.round(parseFloat(rawPrice) * 100) : 0;
    if (rawPrice && !Number.isFinite(priceMinor)) {
      setSaving(false);
      setFeedback("error");
      setFeedbackText("Enter a valid price.");
      return;
    }
    const so = parseInt(sortOrder, 10);
    const result = await updateProduct(salonId, product.id, {
      name: n,
      category: category.trim() || null,
      price_minor: priceMinor,
      currency,
      description,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
      sort_order: Number.isFinite(so) ? so : 0,
      linked_service_ids: linkedServiceIds,
    });
    setSaving(false);
    if (result.error) {
      setFeedback("error");
      setFeedbackText(result.error);
    } else {
      setFeedback("saved");
      window.setTimeout(() => setFeedback(null), 2000);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`Delete "${product.name}"?`)) return;
    setDeleting(true);
    const result = await deleteProduct(salonId, product.id);
    setDeleting(false);
    if (result.error) {
      setFeedback("error");
      setFeedbackText(result.error);
    } else router.refresh();
  }

  const displayCategory = category.trim() || "Uncategorised";

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`product-details-${product.id}`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background/80"
      >
        <ChevronIcon open={expanded} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{name || "Unnamed product"}</span>
        <span className="shrink-0 text-sm text-muted-foreground">{displayCategory}</span>
        {!isActive ? (
          <span className="shrink-0 rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">Inactive</span>
        ) : null}
      </button>

      {expanded ? (
        <div id={`product-details-${product.id}`} className="flex flex-col gap-3 border-t border-border px-4 py-4">
      <div>
        <label htmlFor={`product-name-${product.id}`} className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id={`product-name-${product.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`product-cat-${product.id}`} className="mb-1 block text-sm font-medium">
          Category
        </label>
        <input
          id={`product-cat-${product.id}`}
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Shampoo"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`product-price-${product.id}`} className="mb-1 block text-sm font-medium">
            Price
          </label>
          <input
            id={`product-price-${product.id}`}
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 19.50"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`product-currency-${product.id}`} className="mb-1 block text-sm font-medium">
            Currency
          </label>
          <CurrencySelect
            id={`product-currency-${product.id}`}
            value={currency}
            onChange={setCurrency}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`product-desc-${product.id}`} className="mb-1 block text-sm font-medium">
          Description
        </label>
        <textarea
          id={`product-desc-${product.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          rows={3}
          className={`${inputClass} resize-y min-h-[4.5rem]`}
        />
        <p className="mt-1 text-xs text-muted">
          {description.length} / {DESCRIPTION_MAX}
        </p>
      </div>
      <ProductImageFields
        salonId={salonId}
        idPrefix={`edit-${product.id}`}
        imageUrl={imageUrl}
        onImageUrlChange={setImageUrl}
      />
      <ProductServiceLinksField
        idPrefix={`edit-${product.id}`}
        services={servicesForLinks}
        selectedIds={new Set(linkedServiceIds)}
        onToggle={(id, on) => setLinkedServiceIds((prev) => toggleServiceId(prev, id, on))}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`product-sort-${product.id}`} className="mb-1 block text-sm font-medium">
            Sort order
          </label>
          <input
            id={`product-sort-${product.id}`}
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            Active on shop
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="rounded-lg border border-border px-4 py-2 text-sm text-red-400 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(
              `${window.location.origin}/shop/${salonSlug}#product-${product.id}`
            )
          }
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Copy shop link
        </button>
        {feedback === "saved" && <span className="text-sm text-green-400">Saved.</span>}
        {feedback === "error" && (
          <span className="text-sm text-red-400" role="alert">
            {feedbackText}
          </span>
        )}
      </div>
        </div>
      ) : null}
    </article>
  );
}

export function ProductsView({
  salonId,
  salonSlug,
  canManage,
  products,
  servicesForLinks,
}: {
  salonId: string;
  salonSlug: string;
  canManage: boolean;
  products: ProductRow[];
  servicesForLinks: ServiceLinkOption[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("gbp");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newLinkedServiceIds, setNewLinkedServiceIds] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<"saved" | "error" | null>(null);
  const [addError, setAddError] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvSummary, setCsvSummary] = useState<string | null>(null);
  const [csvRowErrors, setCsvRowErrors] = useState<{ line: number; message: string }[]>([]);
  const [csvImportCurrency, setCsvImportCurrency] = useState("gbp");

  const grouped = useMemo(() => {
    const uncategorised: ProductRow[] = [];
    const byCat = new Map<string, ProductRow[]>();
    for (const p of products) {
      const cat = p.category?.trim();
      if (cat) {
        const list = byCat.get(cat) ?? [];
        list.push(p);
        byCat.set(cat, list);
      } else {
        uncategorised.push(p);
      }
    }
    const groups: { category: string | null; products: ProductRow[] }[] = [];
    for (const cat of [...byCat.keys()].sort((a, b) => a.localeCompare(b))) {
      groups.push({ category: cat, products: byCat.get(cat)! });
    }
    if (uncategorised.length > 0) {
      groups.push({ category: null, products: uncategorised });
    }
    return groups;
  }, [products]);

  if (!canManage) {
    return <p className="text-sm text-muted">Only owners can manage products.</p>;
  }

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted">
        Retail items (shampoos, conditioners, etc.) are separate from appointment services. Your public shop uses the same
        slug as booking:{" "}
        <a href={`/shop/${salonSlug}`} className="font-mono text-accent underline" target="_blank" rel="noreferrer">
          /shop/{salonSlug}
        </a>
        . Clients can book from your{" "}
        <a href={`/book/${salonSlug}`} className="text-accent underline" target="_blank" rel="noreferrer">
          booking page
        </a>
        .
      </p>

      <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-2 text-base font-semibold">Import from CSV</h2>
        <p className="mb-3 text-sm text-muted">
          Columns: <span className="font-mono text-xs">name</span> (required),{" "}
          <span className="font-mono text-xs">price</span> (number only, e.g. 19.50 — currency is chosen below),{" "}
          <span className="font-mono text-xs">category</span>, <span className="font-mono text-xs">description</span>,{" "}
          <span className="font-mono text-xs">image_url</span>, <span className="font-mono text-xs">sort_order</span>,{" "}
          <span className="font-mono text-xs">is_active</span> (true/false). Legacy header{" "}
          <span className="font-mono text-xs">price_gbp</span> still works. Up to 500 rows; avoid line breaks inside cells.
        </p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[min(100%,14rem)]">
            <label htmlFor="csv-import-currency" className="mb-1 block text-sm font-medium">
              Currency for imported prices
            </label>
            <CurrencySelect
              id="csv-import-currency"
              value={csvImportCurrency}
              onChange={setCsvImportCurrency}
            />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
            onClick={() => {
              const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "products-import-template.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download CSV template
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Import products from CSV file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setCsvSummary(null);
              setCsvRowErrors([]);
              setCsvLoading(true);
              try {
                const text = await f.text();
                const result = await importProductsFromCsv(salonId, text, csvImportCurrency);
                if (result.error) {
                  setCsvSummary(result.error);
                  setCsvRowErrors(result.rowErrors);
                } else {
                  const parts = [`Imported ${result.added} product(s).`];
                  if (result.rowErrors.length)
                    parts.push(`${result.rowErrors.length} row(s) skipped (see below).`);
                  setCsvSummary(parts.join(" "));
                  setCsvRowErrors(result.rowErrors);
                  if (result.added > 0) router.refresh();
                }
              } catch (err) {
                setCsvSummary(err instanceof Error ? err.message : "Could not read CSV.");
              } finally {
                setCsvLoading(false);
              }
            }}
          />
          <button
            type="button"
            disabled={csvLoading}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            onClick={() => csvInputRef.current?.click()}
          >
            {csvLoading ? "Importing…" : "Choose CSV file"}
          </button>
        </div>
        {csvSummary ? <p className="text-sm text-muted">{csvSummary}</p> : null}
        {csvRowErrors.length > 0 ? (
          <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-red-400">
            {csvRowErrors.slice(0, 20).map((r) => (
              <li key={`${r.line}-${r.message}`}>
                Line {r.line}: {r.message}
              </li>
            ))}
            {csvRowErrors.length > 20 ? <li>…and {csvRowErrors.length - 20} more</li> : null}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold">Add a product</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            setAddMsg(null);
            setAddError("");
            setAddLoading(true);
            try {
              const rawPrice = newPrice.trim();
              const priceMinor = rawPrice ? Math.round(parseFloat(rawPrice) * 100) : 0;
              if (rawPrice && !Number.isFinite(priceMinor)) {
                setAddMsg("error");
                setAddError("Enter a valid price.");
                return;
              }
              const result = await addProduct(salonId, {
                name: newName.trim(),
                category: newCategory.trim() || null,
                price_minor: priceMinor,
                currency: newCurrency,
                description: newDescription,
                image_url: newImageUrl.trim() || null,
                linked_service_ids: newLinkedServiceIds.length ? newLinkedServiceIds : undefined,
              });
              setAddMsg(result.error ? "error" : "saved");
              if (result.error) setAddError(result.error);
              else {
                setNewName("");
                setNewCategory("");
                setNewPrice("");
                setNewDescription("");
                setNewImageUrl("");
                setNewLinkedServiceIds([]);
                router.refresh();
              }
            } catch (err) {
              setAddMsg("error");
              setAddError(err instanceof Error ? err.message : "Could not add product.");
            } finally {
              setAddLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="new-product-name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input
              id="new-product-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-product-category" className="mb-1 block text-sm font-medium">
              Category
            </label>
            <input
              id="new-product-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-product-price" className="mb-1 block text-sm font-medium">
                Price
              </label>
              <input
                id="new-product-price"
                type="text"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g. 19.50"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-product-currency" className="mb-1 block text-sm font-medium">
                Currency
              </label>
              <CurrencySelect id="new-product-currency" value={newCurrency} onChange={setNewCurrency} />
            </div>
          </div>
          <div>
            <label htmlFor="new-product-desc" className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="new-product-desc"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              rows={3}
              className={`${inputClass} min-h-[4.5rem] resize-y`}
            />
          </div>
          <ProductImageFields
            salonId={salonId}
            idPrefix="new-product"
            imageUrl={newImageUrl}
            onImageUrlChange={setNewImageUrl}
          />
          <ProductServiceLinksField
            idPrefix="new-product"
            services={servicesForLinks}
            selectedIds={new Set(newLinkedServiceIds)}
            onToggle={(id, on) => setNewLinkedServiceIds((prev) => toggleServiceId(prev, id, on))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={addLoading || !newName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {addLoading ? "Adding…" : "Add product"}
            </button>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(`${window.location.origin}/shop/${salonSlug}`)
              }
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Copy shop URL
            </button>
            {addMsg === "saved" && <span className="text-sm text-green-400">Added.</span>}
            {addMsg === "error" && (
              <span className="text-sm text-red-400" role="alert">
                {addError}
              </span>
            )}
          </div>
        </form>
      </div>

      {grouped.map((group) => {
        const key = group.category ?? "__uncategorised";
        const heading = group.category ?? "Uncategorised";
        return (
          <div key={key}>
            <h2 className="mb-3 text-base font-semibold">{heading}</h2>
            <div className="space-y-2">
              {group.products.map((p) => (
                <ProductCard
                  key={p.id}
                  salonId={salonId}
                  salonSlug={salonSlug}
                  servicesForLinks={servicesForLinks}
                  product={p}
                />
              ))}
            </div>
          </div>
        );
      })}

      {products.length === 0 && <p className="text-sm text-muted">No products yet. Add one above.</p>}
    </section>
  );
}
