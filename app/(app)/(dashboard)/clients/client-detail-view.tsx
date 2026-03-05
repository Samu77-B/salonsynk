"use client";

import { useState } from "react";
import { updateClientAction } from "./actions";

type Formula = { text?: string; image_url?: string };
type Appointment = { id: string; start_time: string; end_time: string; status: string; services: { name: string } | { name: string }[] | null };

export function ClientDetailView({
  clientId,
  formulas,
  appointments,
  onPatchTestDueAt,
}: {
  clientId: string;
  formulas: Formula[];
  appointments: Appointment[];
  onPatchTestDueAt: string | null;
}) {
  const [patchDate, setPatchDate] = useState(onPatchTestDueAt?.slice(0, 10) ?? "");
  const [formulaText, setFormulaText] = useState("");
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

  async function handleAddFormula() {
    if (!formulaText.trim()) return;
    setError(null);
    setLoading(true);
    const newFormulas = [...formulas, { text: formulaText.trim() }];
    const result = await updateClientAction(clientId, { color_formulas: newFormulas });
    setLoading(false);
    if (result.error) setError(result.error);
    else setFormulaText("");
  }

  const serviceName = (s: Appointment["services"]) =>
    Array.isArray(s) ? s[0]?.name : s?.name;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Color formulas</h2>
        <ul className="space-y-2 mb-4">
          {formulas.map((f, i) => (
            <li key={i} className="rounded-lg border border-border p-3 text-sm">
              {f.text}
              {f.image_url && <p className="text-muted mt-1">Image: {f.image_url}</p>}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="text"
            value={formulaText}
            onChange={(e) => setFormulaText(e.target.value)}
            placeholder="Add formula (e.g. 6.0 + 30vol)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
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

      <section>
        <h2 className="text-lg font-semibold mb-2">Patch test due date</h2>
        <div className="flex gap-2 items-center">
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
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Appointment history</h2>
        <ul className="space-y-2">
          {(appointments as Appointment[]).map((a) => (
            <li key={a.id} className="flex justify-between rounded-lg border border-border px-4 py-2 text-sm">
              <span>{new Date(a.start_time).toLocaleString("en-GB")}</span>
              <span className="text-muted">{serviceName(a.services) ?? "—"}</span>
              <span className="capitalize">{a.status}</span>
            </li>
          ))}
        </ul>
        {appointments.length === 0 && <p className="text-muted text-sm">No appointments yet.</p>}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
