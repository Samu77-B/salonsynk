"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImageForUpload } from "@core/storage/compress-image-client";
import {
  addBarberTeamMember,
  updateBarberTeamMember,
  uploadBarberTeamMemberAvatar,
  removeBarberTeamMember,
} from "@modules/barber/actions/team";

type Member = {
  id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  chair_number: number | null;
  is_accepting_walk_ins: boolean;
  email?: string | null;
};

function MemberRow({ member }: { member: Member }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [chairNumber, setChairNumber] = useState(
    member.chair_number != null ? String(member.chair_number) : ""
  );
  const [accepting, setAccepting] = useState(member.is_accepting_walk_ins);
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const chair =
        chairNumber.trim() === "" ? null : Number.parseInt(chairNumber, 10);
      const result = await updateBarberTeamMember(member.id, {
        display_name: displayName,
        chair_number: chair != null && !Number.isNaN(chair) ? chair : null,
        is_accepting_walk_ins: accepting,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const prepared = await compressImageForUpload(file);
      const fd = new FormData();
      fd.set("avatar", prepared);
      const result = await uploadBarberTeamMemberAvatar(member.id, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) setAvatarUrl(result.url);
      router.refresh();
    } catch {
      setError("Photo upload failed — the image may be too large. Try again or use a smaller photo.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function handleRemove() {
    const label = member.display_name ?? "this barber";
    if (
      !confirm(
        `Remove ${label} from the team? They will no longer appear on the queue page.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await removeBarberTeamMember(member.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not remove team member. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQueueVisibilityToggle(checked: boolean) {
    setAccepting(checked);
    setLoading(true);
    setError(null);
    try {
      const result = await updateBarberTeamMember(member.id, {
        is_accepting_walk_ins: checked,
      });
      if (result.error) {
        setError(result.error);
        setAccepting(!checked);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update. Please try again.");
      setAccepting(!checked);
    } finally {
      setLoading(false);
    }
  }

  const queueVisibilityControl = (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={accepting}
        onChange={(e) => handleQueueVisibilityToggle(e.target.checked)}
        disabled={loading}
      />
      <span>
        Show on <span className="font-medium">Choose your barber</span> page
      </span>
    </label>
  );

  if (member.role === "owner") {
    return (
      <li className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
        <div className="relative shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-lg font-semibold border border-border">
              {(member.display_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              onChange={handlePhotoChange}
              disabled={loading}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{member.display_name ?? "Owner"}</span>
            <span className="text-muted capitalize text-xs">(owner)</span>
            {!accepting && (
              <span className="text-xs text-accent">Hidden from queue</span>
            )}
          </div>
          {member.email && <p className="text-xs text-muted">{member.email}</p>}
          {queueVisibilityControl}
          <p className="text-xs text-muted">
            Uncheck to hide yourself from the public barber picker.
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3">
      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-14 w-14 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-lg font-semibold border border-border">
            {(member.display_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
          Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            onChange={handlePhotoChange}
            disabled={loading}
          />
        </label>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {editing ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded border border-border bg-canvas px-2 py-1 text-sm"
            />
            <input
              type="number"
              min={1}
              value={chairNumber}
              onChange={(e) => setChairNumber(e.target.value)}
              placeholder="Chair #"
              className="rounded border border-border bg-canvas px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={accepting}
                onChange={(e) => setAccepting(e.target.checked)}
              />
              Show on Choose your barber page
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="rounded bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border border-border px-3 py-1 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{member.display_name ?? "—"}</span>
              {member.chair_number != null && (
                <span className="text-xs text-muted">Chair {member.chair_number}</span>
              )}
              {!accepting && (
                <span className="text-xs text-accent">Hidden from queue</span>
              )}
            </div>
            {member.email && <p className="text-xs text-muted">{member.email}</p>}
            {queueVisibilityControl}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-accent hover:underline"
              >
                Edit name &amp; chair
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                className="text-xs text-red-400 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </li>
  );
}

export function BarberTeamView({ members }: { members: Member[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [chairNumber, setChairNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.set("display_name", displayName);
      fd.set("email", email.trim());
      fd.set("chair_number", chairNumber.trim());
      const file = fileRef.current?.files?.[0];
      if (file) {
        const prepared = await compressImageForUpload(file);
        fd.set("avatar", prepared);
      }

      const result = await addBarberTeamMember(fd);

      if (result.error) {
        setError(result.error);
        if (result.memberId) router.refresh();
        return;
      }

      setDisplayName("");
      setEmail("");
      setChairNumber("");
      if (fileRef.current) fileRef.current.value = "";
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Could not add barber. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </ul>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border border-dashed border-border p-4"
      >
        <p className="text-sm font-medium">Add barber</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-xs text-muted mb-1">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="chair" className="block text-xs text-muted mb-1">
              Chair number
            </label>
            <input
              id="chair"
              type="number"
              min={1}
              value={chairNumber}
              onChange={(e) => setChairNumber(e.target.value)}
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs text-muted mb-1">
              Login email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
              className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="photo" className="block text-xs text-muted mb-1">
              Photo
            </label>
            <input
              ref={fileRef}
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="w-full text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add barber"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Barber added.</p>}
      </form>
    </div>
  );
}
