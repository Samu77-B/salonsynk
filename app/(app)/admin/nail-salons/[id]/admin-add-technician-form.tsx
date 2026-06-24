"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImageForUpload } from "@core/storage/compress-image-client";
import { adminAddNailMember, adminUploadNailMemberAvatar } from "../actions";

export function AdminAddTechnicianForm({ salonId }: { salonId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [stationNumber, setStationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const station =
        stationNumber.trim() === "" ? null : Number.parseInt(stationNumber, 10);

      const result = await adminAddNailMember(salonId, {
        display_name: displayName,
        email: email.trim() || undefined,
        station_number: station != null && !Number.isNaN(station) ? station : null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const file = fileRef.current?.files?.[0];
      if (file && result.memberId) {
        const prepared = await compressImageForUpload(file);
        const fd = new FormData();
        fd.set("avatar", prepared);
        const upload = await adminUploadNailMemberAvatar(salonId, result.memberId, fd);
        if (upload.error) {
          setError(`Technician added but photo upload failed: ${upload.error}`);
          router.refresh();
          return;
        }
      }

      setDisplayName("");
      setEmail("");
      setStationNumber("");
      if (fileRef.current) fileRef.current.value = "";
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Could not add technician. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium">Add technician</p>
      <p className="text-xs text-muted">
        Technicians appear on the public queue page so clients can pick who they want — or choose next
        available. Leave email blank for queue-only profiles without a login.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="technicianName" className="block text-sm font-medium mb-1">
            Display name *
          </label>
          <input
            id="technicianName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            placeholder="e.g. Sophie"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="technicianStation" className="block text-sm font-medium mb-1">
            Station number
          </label>
          <input
            id="technicianStation"
            type="number"
            min={1}
            value={stationNumber}
            onChange={(e) => setStationNumber(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="technicianEmail" className="block text-sm font-medium mb-1">
            Login email
          </label>
          <input
            id="technicianEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Optional — link existing account"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="technicianPhoto" className="block text-sm font-medium mb-1">
            Photo
          </label>
          <input
            ref={fileRef}
            id="technicianPhoto"
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
        {loading ? "Adding…" : "Add technician"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">Technician added.</p>}
    </form>
  );
}
