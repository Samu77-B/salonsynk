"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addService, updateService, deleteService } from "./actions";

type ServiceRow = { id: string; name: string; duration_minutes: number; price_minor: number; processing_time_minutes?: number };

export function ServicesView({
  salonId,
  canManageServices,
  services = [],
}: {
  salonId: string;
  canManageServices: boolean;
  services?: ServiceRow[];
}) {
  const router = useRouter();
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(60);
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceProcessing, setNewServiceProcessing] = useState(0);
  const [serviceMsg, setServiceMsg] = useState<"saved" | "error" | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editPrice, setEditPrice] = useState("");
  const [editProcessing, setEditProcessing] = useState(0);

  if (!canManageServices) {
    return <p className="text-sm text-muted">Only owners can manage services.</p>;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">Services</h2>
      <p className="text-muted text-sm mb-4">
        Add and edit the services clients can book. Set duration and price (optional).
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newServiceName.trim()) return;
          setServiceMsg(null);
          setServiceError("");
          setServiceLoading(true);
          try {
            const rawPrice = newServicePrice.trim();
            const priceMinor = rawPrice ? Math.round(parseFloat(rawPrice) * 100) : 0;
            if (rawPrice && !Number.isFinite(priceMinor)) {
              setServiceMsg("error");
              setServiceError("Enter a valid price.");
              return;
            }
            const result = await addService(salonId, {
              name: newServiceName.trim(),
              duration_minutes: newServiceDuration,
              price_minor: priceMinor,
              processing_time_minutes: newServiceProcessing,
            });
            setServiceMsg(result.error ? "error" : "saved");
            if (result.error) setServiceError(result.error);
            else {
              setNewServiceName("");
              setNewServiceDuration(60);
              setNewServicePrice("");
              setNewServiceProcessing(0);
              router.refresh();
            }
          } catch (err) {
            setServiceMsg("error");
            setServiceError(err instanceof Error ? err.message : "Could not add service. Check your connection and try again.");
          } finally {
            setServiceLoading(false);
          }
        }}
        className="flex flex-wrap gap-2 items-end mb-4"
      >
        <div>
          <label htmlFor="new-service-name" className="block text-sm font-medium mb-1">Name</label>
          <input
            id="new-service-name"
            name="new_service_name"
            type="text"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            placeholder="e.g. Balayage"
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
            aria-label="Service name"
          />
        </div>
        <div>
          <label htmlFor="new-service-duration" className="block text-sm font-medium mb-1">Duration (min)</label>
          <input
            id="new-service-duration"
            name="new_service_duration_min"
            type="number"
            min={5}
            max={480}
            value={newServiceDuration}
            onChange={(e) => setNewServiceDuration(Number(e.target.value) || 60)}
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
            aria-label="Duration in minutes"
          />
        </div>
        <div>
          <label htmlFor="new-service-price" className="block text-sm font-medium mb-1">Price (GBP)</label>
          <input
            id="new-service-price"
            name="new_service_price_gbp"
            type="text"
            inputMode="decimal"
            value={newServicePrice}
            onChange={(e) => setNewServicePrice(e.target.value)}
            placeholder="0"
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
            aria-label="Price in pounds"
          />
        </div>
        <div>
          <label htmlFor="new-service-processing" className="block text-sm font-medium mb-1">Processing (min)</label>
          <input
            id="new-service-processing"
            name="new_service_processing_min"
            type="number"
            min={0}
            max={480}
            value={newServiceProcessing}
            onChange={(e) => setNewServiceProcessing(Number(e.target.value) || 0)}
            autoComplete="off"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
            aria-label="Processing time (e.g. color development)"
          />
        </div>
        <button
          type="submit"
          disabled={serviceLoading || !newServiceName.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {serviceLoading ? "Adding..." : "Add"}
        </button>
        {serviceMsg === "saved" && <span className="text-sm text-green-400">Added.</span>}
        {serviceMsg === "error" && (
          <span className="text-sm text-red-400" role="alert">
            {serviceError ? `Failed: ${serviceError}` : "Failed."}
          </span>
        )}
      </form>
      <ul className="space-y-2">
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0">
            {editingId === s.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded border border-border px-2 py-1 text-sm flex-1 min-w-0"
                  aria-label="Service name"
                  placeholder="Service name"
                />
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value) || 60)}
                  className="rounded border border-border px-2 py-1 text-sm w-16"
                  aria-label="Duration in minutes"
                />
                <input
                  type="text"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="0"
                  className="rounded border border-border px-2 py-1 text-sm w-16"
                  aria-label="Price in pounds"
                />
                <input
                  type="number"
                  min={0}
                  max={480}
                  value={editProcessing}
                  onChange={(e) => setEditProcessing(Number(e.target.value) || 0)}
                  className="rounded border border-border px-2 py-1 text-sm w-14"
                  aria-label="Processing minutes"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setServiceError("");
                    setServiceLoading(true);
                    const result = await updateService(salonId, s.id, {
                      name: editName.trim(),
                      duration_minutes: editDuration,
                      price_minor: editPrice.trim() ? Math.round(parseFloat(editPrice) * 100) : 0,
                      processing_time_minutes: editProcessing,
                    });
                    setServiceLoading(false);
                    if (result.error) {
                      setServiceMsg("error");
                      setServiceError(result.error);
                    } else {
                      setEditingId(null);
                      router.refresh();
                    }
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted hover:underline">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 font-medium truncate">{s.name}</span>
                <span className="text-sm text-muted">{s.duration_minutes} min</span>
                {(s.processing_time_minutes ?? 0) > 0 && (
                  <span className="text-xs text-muted">+{s.processing_time_minutes} proc</span>
                )}
                {s.price_minor > 0 && (
                  <span className="text-sm text-muted">GBP {(s.price_minor / 100).toFixed(2)}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(s.id);
                    setEditName(s.name);
                    setEditDuration(s.duration_minutes);
                    setEditPrice(s.price_minor > 0 ? (s.price_minor / 100).toFixed(2) : "");
                    setEditProcessing(s.processing_time_minutes ?? 0);
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete "${s.name}"?`)) return;
                    setServiceLoading(true);
                    setServiceError("");
                    const result = await deleteService(salonId, s.id);
                    setServiceLoading(false);
                    if (result.error) {
                      setServiceMsg("error");
                      setServiceError(result.error);
                    } else {
                      router.refresh();
                    }
                  }}
                  className="text-sm text-red-400 hover:underline"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {services.length === 0 && (
        <p className="text-sm text-muted">No services yet. Add one above.</p>
      )}
    </section>
  );
}
