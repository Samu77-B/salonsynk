"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addProduct, updateProduct, deleteProduct } from "./actions";

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
};

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm w-full min-w-0 placeholder:text-muted-foreground/60";

function formatGbp(minor: number) {
  return (minor / 100).toFixed(2);
}

function ProductCard({
  salonId,
  salonSlug,
  product,
}: {
  salonId: string;
  salonSlug: string;
  product: ProductRow;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? "");
  const [price, setPrice] = useState(product.price_minor > 0 ? formatGbp(product.price_minor) : "");
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [sortOrder, setSortOrder] = useState(String(product.sort_order));
  const [isActive, setIsActive] = useState(product.is_active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    setName(product.name);
    setCategory(product.category ?? "");
    setPrice(product.price_minor > 0 ? formatGbp(product.price_minor) : "");
    setDescription(product.description ?? "");
    setImageUrl(product.image_url ?? "");
    setSortOrder(String(product.sort_order));
    setIsActive(product.is_active);
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
      description,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
      sort_order: Number.isFinite(so) ? so : 0,
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

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Shampoo"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Price (GBP)</label>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          rows={3}
          className={`${inputClass} resize-y min-h-[4.5rem]`}
        />
        <p className="mt-1 text-xs text-muted">
          {description.length} / {DESCRIPTION_MAX}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Image URL</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Sort order</label>
          <input
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
              `${window.location.origin}/${salonSlug}/shop#product-${product.id}`
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
    </article>
  );
}

export function ProductsView({
  salonId,
  salonSlug,
  canManage,
  products,
}: {
  salonId: string;
  salonSlug: string;
  canManage: boolean;
  products: ProductRow[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<"saved" | "error" | null>(null);
  const [addError, setAddError] = useState("");

  if (!canManage) {
    return <p className="text-sm text-muted">Only owners can manage products.</p>;
  }

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted">
        Retail items (shampoos, conditioners, etc.) are separate from appointment services. Your public shop is at{" "}
        <a href={`/${salonSlug}/shop`} className="font-mono text-accent underline" target="_blank" rel="noreferrer">
          /{salonSlug}/shop
        </a>
        . Clients can book from your{" "}
        <a href={`/book/${salonSlug}`} className="text-accent underline" target="_blank" rel="noreferrer">
          booking page
        </a>
        .
      </p>

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
                description: newDescription,
                image_url: newImageUrl.trim() || null,
              });
              setAddMsg(result.error ? "error" : "saved");
              if (result.error) setAddError(result.error);
              else {
                setNewName("");
                setNewCategory("");
                setNewPrice("");
                setNewDescription("");
                setNewImageUrl("");
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div>
              <label htmlFor="new-product-price" className="mb-1 block text-sm font-medium">
                Price (GBP)
              </label>
              <input
                id="new-product-price"
                type="text"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={inputClass}
              />
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
          <div>
            <label htmlFor="new-product-image" className="mb-1 block text-sm font-medium">
              Image URL (optional)
            </label>
            <input
              id="new-product-image"
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className={inputClass}
            />
          </div>
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
                void navigator.clipboard.writeText(`${window.location.origin}/${salonSlug}/shop`)
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

      {products.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">Your products</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {products.map((p) => (
              <ProductCard key={p.id} salonId={salonId} salonSlug={salonSlug} product={p} />
            ))}
          </div>
        </div>
      )}

      {products.length === 0 && <p className="text-sm text-muted">No products yet. Add one above.</p>}
    </section>
  );
}
