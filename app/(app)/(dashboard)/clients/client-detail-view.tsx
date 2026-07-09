"use client";

import { useState } from "react";
import { updateClientAction, addClientNote, deleteClientNote, type ClientNote } from "./actions";
import { dashboardSectionClass, dashboardStackColClass } from "@/components/dashboard/ui";

export type ColorFormula = {
  text?: string;
  brand?: string;
  formula?: string;
  processing_time?: string;
  result_notes?: string;
  image_url?: string;
  appointment_id?: string;
};
type Appointment = { id: string; start_time: string; end_time: string; status: string; services: { name: string } | { name: string }[] | null };

export type ClientSaleRow = {
  paidAt: string;
  amountMinor: number;
  serviceLabels: string[];
  productLabels: string[];
};

const NOTE_TYPES = [
  { value: "general", label: "General" },
  { value: "colour_formula", label: "Colour formula" },
  { value: "skin_test", label: "Skin test" },
  { value: "allergy", label: "Allergy / sensitivity" },
  { value: "preference", label: "Preference" },
] as const;

export function ClientDetailView({
  clientId,
  salonId,
  formulas,
  appointments,
  sales,
  onPatchTestDueAt,
  onLastSkinTestAt,
  clientNotes = [],
  loyaltyData = null,
}: {
  clientId: string;
  salonId: string;
  formulas: ColorFormula[];
  appointments: Appointment[];
  sales: ClientSaleRow[];
  onPatchTestDueAt: string | null;
  onLastSkinTestAt?: string | null;
  clientNotes?: ClientNote[];
  loyaltyData?: { servicePoints: number; productPoints: number; total_visits: number; tier: string } | null;
}) {
  const [patchDate, setPatchDate] = useState(onPatchTestDueAt?.slice(0, 10) ?? "");
  const [lastSkinTestDate, setLastSkinTestDate] = useState(onLastSkinTestAt?.slice(0, 10) ?? "");
  const [localNotes, setLocalNotes] = useState<ClientNote[]>(clientNotes);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState("general");
  const [noteSaving, setNoteSaving] = useState(false);
  const [formulaText, setFormulaText] = useState("");
  const [brand, setBrand] = useState("");
  const [formula, setFormula] = useState("");
  const [processingTime, setProcessingTime] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [formulaImageUrl, setFormulaImageUrl] = useState("");
  const [useStructured, setUseStructured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePatchTest() {
    setError(null);
    setLoading(true);
    const result = await updateClientAction(clientId, {
      patch_test_due_at: patchDate ? `${patchDate}T12:00:00` : null,
    });
    setLoading(false);
    if (result.error) setError(result.error);
  }

  async function handleSaveSkinTest() {
    setError(null);
    setLoading(true);
    const result = await updateClientAction(clientId, {
      last_skin_test_at: lastSkinTestDate ? `${lastSkinTestDate}T12:00:00` : null,
    });
    setLoading(false);
    if (result.error) setError(result.error);
  }

  async function handleAddFormula() {
    if (useStructured) {
      if (!formula.trim() && !brand.trim()) return;
      setError(null);
      setLoading(true);
      const entry: ColorFormula = {
        brand: brand.trim() || undefined,
        formula: formula.trim() || undefined,
        processing_time: processingTime.trim() || undefined,
        result_notes: resultNotes.trim() || undefined,
        image_url: formulaImageUrl.trim() || undefined,
      };
      const newFormulas = [...formulas, entry];
      const result = await updateClientAction(clientId, { color_formulas: newFormulas });
      setLoading(false);
      if (result.error) setError(result.error);
      else {
        setBrand("");
        setFormula("");
        setProcessingTime("");
        setResultNotes("");
        setFormulaImageUrl("");
      }
    } else {
      if (!formulaText.trim()) return;
      setError(null);
      setLoading(true);
      const newFormulas = [...formulas, { text: formulaText.trim() }];
      const result = await updateClientAction(clientId, { color_formulas: newFormulas });
      setLoading(false);
      if (result.error) setError(result.error);
      else setFormulaText("");
    }
  }

  const serviceName = (s: Appointment["services"]) =>
    Array.isArray(s) ? s[0]?.name : s?.name;

  async function handleAddNote() {
    if (!newNoteText.trim()) return;
    setNoteSaving(true);
    setError(null);
    const result = await addClientNote(clientId, salonId, newNoteText, newNoteType);
    setNoteSaving(false);
    if (result.error) { setError(result.error); return; }
    if (result.noteRow) setLocalNotes((prev) => [result.noteRow!, ...prev]);
    setNewNoteText("");
    setNewNoteType("general");
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    setError(null);
    const result = await deleteClientNote(noteId, clientId);
    if (result.error) { setError(result.error); return; }
    setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  return (
    <div className={`${dashboardStackColClass}`}>
      {loyaltyData && (
        <section className={dashboardSectionClass}>
          <h2 className="text-lg font-semibold mb-2">Loyalty</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide border ${
              loyaltyData.tier === "gold" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
              : loyaltyData.tier === "silver" ? "bg-zinc-400/15 text-zinc-300 border-zinc-400/30"
              : "bg-orange-500/15 text-orange-300 border-orange-500/30"
            }`}>
              {loyaltyData.tier}
            </span>
            <div className="text-sm">
              <span className="font-semibold">{loyaltyData.servicePoints}</span>{" "}
              <span className="text-muted">service pts</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{loyaltyData.productPoints}</span>{" "}
              <span className="text-muted">product pts</span>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{loyaltyData.total_visits}</span> <span className="text-muted">visits</span>
            </div>
          </div>
        </section>
      )}

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Notes</h2>
        <div className="space-y-3 mb-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={newNoteType}
              onChange={(e) => setNewNoteType(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-44 shrink-0"
              aria-label="Note type"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Add a note..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNote())}
              className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={noteSaving || !newNoteText.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50 shrink-0"
            >
              {noteSaving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
        {localNotes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {localNotes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded bg-muted/30 px-2 py-0.5 text-xs font-medium capitalize mb-1">
                      {NOTE_TYPES.find((t) => t.value === n.note_type)?.label ?? n.note_type}
                    </span>
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(n.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(n.id)}
                    className="shrink-0 text-xs text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Color history</h2>
        <ul className="space-y-2 mb-4">
          {formulas.map((f, i) => (
            <li key={i} className="rounded-lg border border-border p-3 text-sm space-y-1">
              {f.text && <p>{f.text}</p>}
              {(f.brand || f.formula || f.processing_time || f.result_notes) && (
                <div className="grid gap-1 text-muted">
                  {f.brand && <span><strong>Brand:</strong> {f.brand}</span>}
                  {f.formula && <span><strong>Formula:</strong> {f.formula}</span>}
                  {f.processing_time && <span><strong>Processing:</strong> {f.processing_time}</span>}
                  {f.result_notes && <span><strong>Result:</strong> {f.result_notes}</span>}
                </div>
              )}
              {f.image_url && (
                <p className="mt-1">
                  <a href={f.image_url} target="_blank" rel="noopener noreferrer" className="text-accent underline">View image</a>
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useStructured} onChange={(e) => setUseStructured(e.target.checked)} className="rounded border-border" />
            <span className="text-sm">Structured fields (Brand, Formula, etc.)</span>
          </label>
          {useStructured ? (
            <div className="grid gap-2 rounded-lg border border-border p-3">
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="text" value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="Formula (e.g. 6.0 + 20vol)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="text" value={processingTime} onChange={(e) => setProcessingTime(e.target.value)} placeholder="Processing time" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="text" value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} placeholder="Result notes" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="url" value={formulaImageUrl} onChange={(e) => setFormulaImageUrl(e.target.value)} placeholder="Image URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          ) : (
            <input
              type="text"
              value={formulaText}
              onChange={(e) => setFormulaText(e.target.value)}
              placeholder="Add formula (e.g. 6.0 + 30vol)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            onClick={handleAddFormula}
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Skin &amp; Patch Testing</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Last skin test date</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:items-center">
              <input
                type="date"
                value={lastSkinTestDate}
                onChange={(e) => setLastSkinTestDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveSkinTest}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Save
              </button>
            </div>
            {lastSkinTestDate && (() => {
              const testDate = new Date(lastSkinTestDate);
              const monthsSince = Math.floor((Date.now() - testDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
              if (monthsSince >= 12) {
                return <p className="text-xs text-red-400 mt-1">Skin test expired — over 12 months ago ({monthsSince} months)</p>;
              }
              if (monthsSince >= 10) {
                return <p className="text-xs text-amber-400 mt-1">Skin test expires soon ({12 - monthsSince} months remaining)</p>;
              }
              return <p className="text-xs text-green-400 mt-1">Skin test valid ({12 - monthsSince} months remaining)</p>;
            })()}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Patch test due date</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 sm:items-center">
              <input
                type="date"
                value={patchDate}
                onChange={(e) => setPatchDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSavePatchTest}
                disabled={loading}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Purchase history</h2>
        <p className="text-xs text-muted mb-2">Successful Stripe payments linked to this client (services and retail).</p>
        {sales.length === 0 ? (
          <p className="text-sm text-muted">No recorded sales yet.</p>
        ) : (
          <ul className="space-y-2">
            {sales.map((s, idx) => (
              <li key={`${s.paidAt}-${idx}`} className="rounded-lg border border-border px-4 py-2 text-sm space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{new Date(s.paidAt).toLocaleString("en-GB")}</span>
                  <span className="font-medium">
                    £{(s.amountMinor / 100).toFixed(2)}
                  </span>
                </div>
                {s.serviceLabels.length > 0 && (
                  <p className="text-muted text-xs">
                    <span className="text-foreground/80">Services:</span> {s.serviceLabels.join(", ")}
                  </p>
                )}
                {s.productLabels.length > 0 && (
                  <p className="text-muted text-xs">
                    <span className="text-foreground/80">Products:</span> {s.productLabels.join(", ")}
                  </p>
                )}
                {s.serviceLabels.length === 0 && s.productLabels.length === 0 && (
                  <p className="text-muted text-xs">Custom or unitemised payment</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Appointment history</h2>
        <ul className="space-y-2">
          {(appointments as Appointment[]).map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-2 gap-y-1 justify-between rounded-lg border border-border px-4 py-2 text-sm min-w-0">
              <span className="shrink-0">{new Date(a.start_time).toLocaleString("en-GB")}</span>
              <span className="text-muted truncate">{serviceName(a.services) ?? "—"}</span>
              <span className="capitalize shrink-0">{a.status}</span>
            </li>
          ))}
        </ul>
        {appointments.length === 0 && <p className="text-muted text-sm">No appointments yet.</p>}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
