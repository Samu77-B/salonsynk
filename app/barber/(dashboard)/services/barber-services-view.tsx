"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addBarberService,
  updateBarberService,
  deleteBarberService,
  addBarberCategory,
  updateBarberCategory,
  deleteBarberCategory,
} from "@modules/barber/actions/services";
import { formatDurationMinutes } from "@/lib/format-duration";
import {
  groupBarberServicesByCategory,
  type BarberServiceCategory,
} from "@modules/barber/lib/service-categories";

export type BarberServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
  sort_order: number;
  category_id?: string | null;
};

const inputClass = "w-full rounded border border-border bg-canvas px-3 py-2 text-sm";

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function minorToGbpInput(minor: number): string {
  if (minor <= 0) return "";
  return (minor / 100).toFixed(2).replace(/\.00$/, "");
}

function CategorySelect({
  id,
  value,
  categories,
  onChange,
}: {
  id: string;
  value: string | null;
  categories: BarberServiceCategory[];
  onChange: (catId: string | null) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted mb-1">
        Category
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={inputClass}
      >
        <option value="">Uncategorised</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CategoryManager({ categories }: { categories: BarberServiceCategory[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    setAdding(true);
    setError(null);
    const res = await addBarberCategory({ name: n });
    setAdding(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function handleRename(catId: string) {
    const n = editName.trim();
    if (!n) return;
    setSaving(true);
    setError(null);
    const res = await updateBarberCategory(catId, { name: n });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(cat: BarberServiceCategory) {
    if (!confirm(`Delete category "${cat.name}"? Services in it will become uncategorised.`)) return;
    setDeletingId(cat.id);
    setError(null);
    const res = await deleteBarberCategory(cat.id);
    setDeletingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded border border-border p-4">
      <div>
        <h2 className="text-sm font-medium">Categories</h2>
        <p className="text-xs text-muted mt-1">
          Group cuts under headings like &ldquo;Fades&rdquo; or &ldquo;Beard&rdquo;. These headings show on your
          public queue and booking page.
        </p>
      </div>

      {categories.length > 0 && (
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center gap-2 rounded border border-border px-3 py-2 text-sm"
            >
              {editingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className={`${inputClass} max-w-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename(cat.id)}
                    disabled={saving || !editName.trim()}
                    className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-muted hover:underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="font-medium">{cat.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                    }}
                    className="text-xs text-foreground hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(cat)}
                    disabled={deletingId === cat.id}
                    className="text-xs text-red-400 hover:underline disabled:opacity-50"
                  >
                    {deletingId === cat.id ? "Deleting…" : "Delete"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="new-cat-name" className="block text-xs text-muted mb-1">
            New category
          </label>
          <input
            id="new-cat-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Fades"
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="shrink-0 rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ServiceRow({
  service,
  categories,
}: {
  service: BarberServiceRow;
  categories: BarberServiceCategory[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [price, setPrice] = useState(minorToGbpInput(service.price_minor));
  const [categoryId, setCategoryId] = useState<string | null>(service.category_id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const result = await updateBarberService(service.id, {
      name,
      duration_minutes: Number.parseInt(duration, 10),
      price_gbp: price,
      clear_price: !price.trim(),
      category_id: categoryId,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Remove "${service.name}" from your service list?`)) return;
    setLoading(true);
    setError(null);
    const result = await deleteBarberService(service.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <li className="rounded border border-border p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <CategorySelect
            id={`edit-cat-${service.id}`}
            value={categoryId}
            categories={categories}
            onChange={setCategoryId}
          />
          <div>
            <label className="block text-xs text-muted mb-1">Duration</label>
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[10px] text-muted">
              {formatDurationMinutes(Number.parseInt(duration, 10) || 0)}
            </p>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Price (£, optional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="No fixed price"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(service.name);
              setDuration(String(service.duration_minutes));
              setPrice(minorToGbpInput(service.price_minor));
              setCategoryId(service.category_id ?? null);
            }}
            className="rounded border border-border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-border p-3">
      <div>
        <p className="font-medium">{service.name}</p>
        <p className="text-xs text-muted mt-0.5">
          {formatDurationMinutes(service.duration_minutes)}
          {service.price_minor > 0 ? ` · ${formatPrice(service.price_minor)}` : " · No fixed price"}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-foreground hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-400 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function BarberServicesView({
  services,
  categories = [],
}: {
  services: BarberServiceRow[];
  categories?: BarberServiceCategory[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const grouped = useMemo(
    () => groupBarberServicesByCategory(services, categories),
    [services, categories]
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const result = await addBarberService({
      name,
      duration_minutes: Number.parseInt(duration, 10),
      price_gbp: price,
      category_id: categoryId,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setDuration("30");
    setPrice("");
    setCategoryId(null);
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <CategoryManager categories={categories} />

      {services.length === 0 ? (
        <p className="text-sm text-muted rounded border border-dashed border-border p-4">
          No services yet. Add your first cut below — price is optional.
        </p>
      ) : categories.length === 0 ? (
        <ul className="space-y-2">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} categories={categories} />
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => {
            if (group.services.length === 0) return null;
            const key = group.category?.id ?? "__uncategorised";
            return (
              <div key={key} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {group.category?.name ?? "Uncategorised"}
                </h3>
                <ul className="space-y-2">
                  {group.services.map((s) => (
                    <ServiceRow key={s.id} service={s} categories={categories} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded border border-dashed border-border p-4"
      >
        <p className="text-sm font-medium">Add service</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="svc-name" className="block text-xs text-muted mb-1">
              Name *
            </label>
            <input
              id="svc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Skin fade"
              className={inputClass}
            />
          </div>
          <CategorySelect
            id="svc-category"
            value={categoryId}
            categories={categories}
            onChange={setCategoryId}
          />
          <div>
            <label htmlFor="svc-duration" className="block text-xs text-muted mb-1">
              Duration *
            </label>
            <input
              id="svc-duration"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
              className={inputClass}
            />
            <p className="mt-1 text-[10px] text-muted">
              {formatDurationMinutes(Number.parseInt(duration, 10) || 0)}
            </p>
          </div>
          <div>
            <label htmlFor="svc-price" className="block text-xs text-muted mb-1">
              Price (£, optional)
            </label>
            <input
              id="svc-price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Leave blank for no price"
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          Services appear on your public queue page, live queue, and bookings diary. Leave price
          blank if you don&apos;t want a fixed price shown.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add service"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Service added.</p>}
      </form>
    </div>
  );
}
