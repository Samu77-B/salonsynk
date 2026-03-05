"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSalonAndOwner, addOnboardingServices } from "./actions";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<"salon" | "services" | "done">("salon");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [services, setServices] = useState([{ name: "", duration_minutes: 60 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);

  async function handleSalonSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createSalonAndOwner(name, slug || slugFromName(name));
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.salonId) {
      setSalonId(result.salonId);
      setStep("services");
    }
  }

  async function handleServicesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!salonId) return;
    const toAdd = services.filter((s) => s.name.trim());
    setLoading(true);
    const result = await addOnboardingServices(salonId, toAdd);
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setStep("done");
      router.refresh();
      router.push("/dashboard");
    }
  }

  if (step === "services") {
    return (
      <form onSubmit={handleServicesSubmit} className="space-y-4">
        <p className="text-sm text-muted">Add 1–2 services (optional). You can add more later.</p>
        {services.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={s.name}
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...next[i], name: e.target.value };
                setServices(next);
              }}
              placeholder="Service name"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={15}
              step={15}
              value={s.duration_minutes}
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...next[i], duration_minutes: Number(e.target.value) || 60 };
                setServices(next);
              }}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setServices([...services, { name: "", duration_minutes: 60 }])}
          className="text-sm text-accent hover:underline"
        >
          + Add another
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setStep("salon")}
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "Saving…" : "Continue to dashboard"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSalonSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Business name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug) setSlug(slugFromName(e.target.value));
          }}
          required
          placeholder="e.g. The Hair Studio"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">
          URL slug (for booking link)
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={slugFromName(name) || "my-salon"}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-muted mt-1">salonsynk.com/book/{slug || "my-salon"}</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create salon & continue"}
      </button>
    </form>
  );
}
