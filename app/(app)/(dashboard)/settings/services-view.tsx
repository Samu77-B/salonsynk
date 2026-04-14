"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addService, updateService, deleteService } from "./actions";

const DESCRIPTION_MAX = 2000;

const SERVICE_COLORS = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#84cc16",
  "#6366f1", "#0ea5e9",
];

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
  processing_time_minutes?: number;
  description?: string;
  color?: string;
};

const inputClass =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm w-full min-w-0 placeholder:text-muted-foreground/60";

function defaultProcessingMinutes(durationMin: number): number {
  const half = Math.floor(durationMin / 2);
  const v = half >= 15 ? half : 30;
  return Math.min(durationMin, Math.max(15, v));
}

function ServiceCard({ salonId, service }: { salonId: string; service: ServiceRow }) {
  const router = useRouter();
  const [name, setName] = useState(service.name);
  const [duration, setDuration] = useState(service.duration_minutes);
  const [price, setPrice] = useState(service.price_minor > 0 ? (service.price_minor / 100).toFixed(2) : "");
  const initialProc = service.processing_time_minutes ?? 0;
  const [allowOverlap, setAllowOverlap] = useState(initialProc > 0);
  const [processing, setProcessing] = useState(initialProc > 0 ? initialProc : defaultProcessingMinutes(service.duration_minutes));
  const [description, setDescription] = useState(service.description ?? "");
  const [serviceColor, setServiceColor] = useState(service.color ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    setName(service.name);
    setDuration(service.duration_minutes);
    setPrice(service.price_minor > 0 ? (service.price_minor / 100).toFixed(2) : "");
    const p = service.processing_time_minutes ?? 0;
    setAllowOverlap(p > 0);
    setProcessing(p > 0 ? p : defaultProcessingMinutes(service.duration_minutes));
    setDescription(service.description ?? "");
    setServiceColor(service.color ?? "");
  }, [
    service.id,
    service.name,
    service.duration_minutes,
    service.price_minor,
    service.processing_time_minutes,
    service.description,
    service.color,
  ]);

  async function save() {
    const n = name.trim();
    if (!n) {
      setFeedback("error");
      setFeedbackText("Name is required.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    setFeedbackText("");
    const rawPrice = price.trim();
    const priceMinor = rawPrice ? Math.round(parseFloat(rawPrice) * 100) : 0;
    if (rawPrice && !Number.isFinite(priceMinor)) {
      setSaving(false);
      setFeedback("error");
      setFeedbackText("Enter a valid price.");
      return;
    }
    let procSubmit = 0;
    if (allowOverlap) {
      const p = Math.round(processing);
      if (!Number.isFinite(p) || p < 1) {
        setSaving(false);
        setFeedback("error");
        setFeedbackText("Enter processing time (at least 1 minute), or turn off overlap.");
        return;
      }
      procSubmit = Math.min(duration, p);
    }
    const result = await updateService(salonId, service.id, {
      name: n,
      duration_minutes: duration,
      price_minor: priceMinor,
      processing_time_minutes: procSubmit,
      description,
      color: serviceColor,
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
    if (!confirm(`Delete "${service.name}"?`)) return;
    setDeleting(true);
    setFeedback(null);
    const result = await deleteService(salonId, service.id);
    setDeleting(false);
    if (result.error) {
      setFeedback("error");
      setFeedbackText(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div>
        <label htmlFor={`svc-name-${service.id}`} className="mb-1 block text-sm font-medium">
          Service name
        </label>
        <input
          id={`svc-name-${service.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Balayage"
          autoComplete="off"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`svc-dur-${service.id}`} className="mb-1 block text-sm font-medium">
            Duration (min)
          </label>
          <input
            id={`svc-dur-${service.id}`}
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => {
              const d = Number(e.target.value) || 60;
              setDuration(d);
              if (allowOverlap) setProcessing((prev) => Math.min(d, Math.max(1, prev)));
            }}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`svc-price-${service.id}`} className="mb-1 block text-sm font-medium">
            Price (GBP)
          </label>
          <input
            id={`svc-price-${service.id}`}
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            autoComplete="off"
            className={inputClass}
          />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-background/40 p-3">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowOverlap}
            onChange={(e) => {
              const on = e.target.checked;
              setAllowOverlap(on);
              if (on) {
                setProcessing((prev) => (prev > 0 ? Math.min(duration, prev) : defaultProcessingMinutes(duration)));
              } else {
                setProcessing(0);
              }
            }}
            className="mt-1 rounded border-border"
          />
          <span>
            <span className="font-medium text-foreground">Stylist can see another client during processing</span>
            <span className="mt-1 block text-muted">
              Use for treatments like colour: while the client&apos;s hair processes, the diary allows another booking in that
              window. Set how long that processing period lasts (cannot exceed total duration).
            </span>
          </span>
        </label>
        {allowOverlap ? (
          <div className="mt-3 sm:max-w-xs">
            <label htmlFor={`svc-proc-${service.id}`} className="mb-1 block text-sm font-medium">
              Processing time (minutes)
            </label>
            <input
              id={`svc-proc-${service.id}`}
              type="number"
              min={1}
              max={duration}
              value={processing}
              onChange={(e) => setProcessing(Number(e.target.value) || 0)}
              autoComplete="off"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-muted">Max {duration} (full appointment length).</p>
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor={`svc-desc-${service.id}`} className="mb-1 block text-sm font-medium">
          More info
        </label>
        <textarea
          id={`svc-desc-${service.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
          placeholder="What is included, prep notes, or anything clients or staff should know."
          rows={4}
          maxLength={DESCRIPTION_MAX}
          className={`${inputClass} resize-y min-h-[5rem]`}
        />
        <p className="mt-1 text-xs text-muted">
          {description.length} / {DESCRIPTION_MAX}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Diary colour</label>
        <p className="mb-2 text-xs text-muted">Appointment blocks on the diary will use this colour.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setServiceColor("")}
            className={`h-8 w-8 rounded-full border-2 shrink-0 ${!serviceColor ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
            style={{ backgroundColor: "var(--muted)" }}
            title="No colour (default)"
            aria-label="No colour"
          />
          {SERVICE_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setServiceColor(hex)}
              className={`h-8 w-8 rounded-full border-2 shrink-0 ${serviceColor === hex ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
              style={{ backgroundColor: hex }}
              title={hex}
              aria-label={`Colour ${hex}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || deleting || !name.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={saving || deleting}
          className="rounded-lg px-3 py-2 text-sm text-red-400 hover:underline disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        {feedback === "saved" && <span className="text-sm text-green-400">Saved.</span>}
        {feedback === "error" && (
          <span className="text-sm text-red-400" role="alert">
            {feedbackText || "Something went wrong."}
          </span>
        )}
      </div>
    </article>
  );
}

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
  const [newAllowOverlap, setNewAllowOverlap] = useState(false);
  const [newServiceProcessing, setNewServiceProcessing] = useState(() => defaultProcessingMinutes(60));
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceColor, setNewServiceColor] = useState("");
  const [addMsg, setAddMsg] = useState<"saved" | "error" | null>(null);
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  if (!canManageServices) {
    return <p className="text-sm text-muted">Only owners can manage services.</p>;
  }

  return (
    <section className="space-y-6">
      <p className="text-sm text-muted">
        Each service is a card: set timing and price. Optional: allow <span className="font-medium text-foreground">overlap</span>{" "}
        when the client is processing (e.g. colour developing) so another client can be booked in that gap. Use{" "}
        <span className="font-medium text-foreground">More info</span> for details, aftercare, or internal notes.
      </p>

      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold">Add a service</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newServiceName.trim()) return;
            setAddMsg(null);
            setAddError("");
            setAddLoading(true);
            try {
              const rawPrice = newServicePrice.trim();
              const priceMinor = rawPrice ? Math.round(parseFloat(rawPrice) * 100) : 0;
              if (rawPrice && !Number.isFinite(priceMinor)) {
                setAddMsg("error");
                setAddError("Enter a valid price.");
                return;
              }
              let proc = 0;
              if (newAllowOverlap) {
                const p = Math.round(newServiceProcessing);
                if (!Number.isFinite(p) || p < 1) {
                  setAddMsg("error");
                  setAddError("Enter processing time (at least 1 minute), or turn off overlap.");
                  return;
                }
                proc = Math.min(newServiceDuration, p);
              }
              const result = await addService(salonId, {
                name: newServiceName.trim(),
                duration_minutes: newServiceDuration,
                price_minor: priceMinor,
                processing_time_minutes: proc,
                description: newServiceDescription,
                color: newServiceColor,
              });
              setAddMsg(result.error ? "error" : "saved");
              if (result.error) setAddError(result.error);
              else {
                setNewServiceName("");
                setNewServiceDuration(60);
                setNewServicePrice("");
                setNewAllowOverlap(false);
                setNewServiceProcessing(defaultProcessingMinutes(60));
                setNewServiceDescription("");
                setNewServiceColor("");
                router.refresh();
              }
            } catch (err) {
              setAddMsg("error");
              setAddError(err instanceof Error ? err.message : "Could not add service. Check your connection and try again.");
            } finally {
              setAddLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="new-service-name" className="mb-1 block text-sm font-medium">
              Service name
            </label>
            <input
              id="new-service-name"
              name="new_service_name"
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="e.g. Balayage"
              autoComplete="off"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-service-duration" className="mb-1 block text-sm font-medium">
                Duration (min)
              </label>
              <input
                id="new-service-duration"
                name="new_service_duration_min"
                type="number"
                min={5}
                max={480}
                value={newServiceDuration}
                onChange={(e) => {
                  const d = Number(e.target.value) || 60;
                  setNewServiceDuration(d);
                  if (newAllowOverlap) {
                    setNewServiceProcessing((prev) => (prev > 0 ? Math.min(d, prev) : defaultProcessingMinutes(d)));
                  }
                }}
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-service-price" className="mb-1 block text-sm font-medium">
                Price (GBP)
              </label>
              <input
                id="new-service-price"
                name="new_service_price_gbp"
                type="text"
                inputMode="decimal"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="0"
                autoComplete="off"
                className={inputClass}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={newAllowOverlap}
                onChange={(e) => {
                  const on = e.target.checked;
                  setNewAllowOverlap(on);
                  if (on) {
                    setNewServiceProcessing((prev) =>
                      prev > 0 ? Math.min(newServiceDuration, prev) : defaultProcessingMinutes(newServiceDuration)
                    );
                  } else {
                    setNewServiceProcessing(0);
                  }
                }}
                className="mt-1 rounded border-border"
              />
              <span>
                <span className="font-medium text-foreground">Stylist can see another client during processing</span>
                <span className="mt-1 block text-muted">
                  e.g. colour developing — set how long the client is left processing (up to the full duration).
                </span>
              </span>
            </label>
            {newAllowOverlap ? (
              <div className="mt-3 sm:max-w-xs">
                <label htmlFor="new-service-processing" className="mb-1 block text-sm font-medium">
                  Processing time (minutes)
                </label>
                <input
                  id="new-service-processing"
                  name="new_service_processing_min"
                  type="number"
                  min={1}
                  max={newServiceDuration}
                  value={newServiceProcessing}
                  onChange={(e) => setNewServiceProcessing(Number(e.target.value) || 0)}
                  autoComplete="off"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-muted">Max {newServiceDuration}.</p>
              </div>
            ) : null}
          </div>
          <div>
            <label htmlFor="new-service-description" className="mb-1 block text-sm font-medium">
              More info
            </label>
            <textarea
              id="new-service-description"
              name="new_service_description"
              value={newServiceDescription}
              onChange={(e) => setNewServiceDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="Optional: what is included, timing notes, or client-facing copy."
              rows={3}
              maxLength={DESCRIPTION_MAX}
              className={`${inputClass} resize-y min-h-[4.5rem]`}
            />
            <p className="mt-1 text-xs text-muted">
              {newServiceDescription.length} / {DESCRIPTION_MAX}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Diary colour</label>
            <p className="mb-2 text-xs text-muted">Appointment blocks on the diary will use this colour.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewServiceColor("")}
                className={`h-8 w-8 rounded-full border-2 shrink-0 ${!newServiceColor ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                style={{ backgroundColor: "var(--muted)" }}
                title="No colour (default)"
                aria-label="No colour"
              />
              {SERVICE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setNewServiceColor(hex)}
                  className={`h-8 w-8 rounded-full border-2 shrink-0 ${newServiceColor === hex ? "border-foreground ring-2 ring-offset-2 ring-offset-background ring-accent" : "border-transparent"}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  aria-label={`Colour ${hex}`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={addLoading || !newServiceName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {addLoading ? "Adding…" : "Add service"}
            </button>
            {addMsg === "saved" && <span className="text-sm text-green-400">Added.</span>}
            {addMsg === "error" && (
              <span className="text-sm text-red-400" role="alert">
                {addError ? `Failed: ${addError}` : "Failed."}
              </span>
            )}
          </div>
        </form>
      </div>

      {services.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">Your services</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s.id} salonId={salonId} service={s} />
            ))}
          </div>
        </div>
      )}

      {services.length === 0 && <p className="text-sm text-muted">No services yet. Add one in the form above.</p>}
    </section>
  );
}
