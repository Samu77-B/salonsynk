"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAddBarberMember, adminUploadBarberMemberAvatar } from "../actions";

export function AdminAddBarberForm({ shopId }: { shopId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [chairNumber, setChairNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const chair =
      chairNumber.trim() === "" ? null : Number.parseInt(chairNumber, 10);

    const result = await adminAddBarberMember(shopId, {
      display_name: displayName,
      email: email.trim() || undefined,
      chair_number: chair != null && !Number.isNaN(chair) ? chair : null,
    });

    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (file && result.memberId) {
      const fd = new FormData();
      fd.set("avatar", file);
      const upload = await adminUploadBarberMemberAvatar(shopId, result.memberId, fd);
      if (upload.error) {
        setLoading(false);
        setError(`Barber added but photo upload failed: ${upload.error}`);
        router.refresh();
        return;
      }
    }

    setLoading(false);
    setDisplayName("");
    setEmail("");
    setChairNumber("");
    if (fileRef.current) fileRef.current.value = "";
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium">Add barber</p>
      <p className="text-xs text-muted">
        Barbers appear on the public queue page so clients can pick who they want — or choose next
        available. Leave email blank for queue-only profiles without a login.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="barberName" className="block text-sm font-medium mb-1">
            Display name *
          </label>
          <input
            id="barberName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="e.g. Marcus"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="barberChair" className="block text-sm font-medium mb-1">
            Chair number
          </label>
          <input
            id="barberChair"
            type="number"
            min={1}
            value={chairNumber}
            onChange={(e) => setChairNumber(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="barberEmail" className="block text-sm font-medium mb-1">
            Login email
          </label>
          <input
            id="barberEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Optional — link existing account"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="barberPhoto" className="block text-sm font-medium mb-1">
            Photo
          </label>
          <input
            ref={fileRef}
            id="barberPhoto"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add barber"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">Barber added.</p>}
    </form>
  );
}
