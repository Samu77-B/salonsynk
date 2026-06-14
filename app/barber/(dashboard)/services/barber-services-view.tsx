"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addBarberService,
  updateBarberService,
  deleteBarberService,
} from "@modules/barber/actions/services";

export type BarberServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
  sort_order: number;
};

function formatPrice(minor: number): string {
  return `£${(minor / 100).toFixed(2)}`;
}

function minorToGbpInput(minor: number): string {
  if (minor <= 0) return "";
  return (minor / 100).toFixed(2).replace(/\.00$/, "");
}

function ServiceRow({ service }: { service: BarberServiceRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(String(service.duration_minutes));
  const [price, setPrice] = useState(minorToGbpInput(service.price_minor));
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
      <li className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-xs text-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Duration (mins)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Price (£, optional)</label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="No fixed price"
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
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
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="font-medium">{service.name}</p>
        <p className="text-xs text-muted mt-0.5">
          {service.duration_minutes} mins
          {service.price_minor > 0 ? ` · ${formatPrice(service.price_minor)}` : " · No fixed price"}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-blue-400 hover:underline"
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

export function BarberServicesView({ services }: { services: BarberServiceRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const result = await addBarberService({
      name,
      duration_minutes: Number.parseInt(duration, 10),
      price_gbp: price,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setDuration("30");
    setPrice("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {services.length === 0 ? (
        <p className="text-sm text-muted rounded-lg border border-dashed border-border p-4">
          No services yet. Add your first cut below — price is optional.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
        </ul>
      )}

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border border-dashed border-border p-4"
      >
        <p className="text-sm font-medium">Add service</p>
        <div className="grid gap-3 sm:grid-cols-3">
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
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="svc-duration" className="block text-xs text-muted mb-1">
              Duration (mins) *
            </label>
            <input
              id="svc-duration"
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
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
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
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
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add service"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Service added.</p>}
      </form>
    </div>
  );
}
