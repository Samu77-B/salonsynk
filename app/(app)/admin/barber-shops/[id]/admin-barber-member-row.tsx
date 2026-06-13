"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImageForUpload } from "@core/storage/compress-image-client";
import {
  adminUpdateBarberMember,
  adminUploadBarberMemberAvatar,
  adminRemoveBarberMember,
} from "../actions";

type Member = {
  id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  chair_number: number | null;
  is_accepting_walk_ins: boolean;
  email?: string | null;
};

export function AdminBarberMemberRow({ shopId, member }: { shopId: string; member: Member }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [chairNumber, setChairNumber] = useState(
    member.chair_number != null ? String(member.chair_number) : ""
  );
  const [accepting, setAccepting] = useState(member.is_accepting_walk_ins);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(member.avatar_url);

  async function handleSave() {
    setLoading(true);
    setError(null);
    const chair =
      chairNumber.trim() === "" ? null : Number.parseInt(chairNumber, 10);
    const result = await adminUpdateBarberMember(shopId, member.id, {
      display_name: displayName,
      chair_number: chair != null && !Number.isNaN(chair) ? chair : null,
      is_accepting_walk_ins: accepting,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
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
      const result = await adminUploadBarberMemberAvatar(shopId, member.id, fd);
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
    const result = await adminRemoveBarberMember(shopId, member.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleQueueVisibilityToggle(checked: boolean) {
    setAccepting(checked);
    setLoading(true);
    setError(null);
    const result = await adminUpdateBarberMember(shopId, member.id, {
      is_accepting_walk_ins: checked,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setAccepting(!checked);
      return;
    }
    router.refresh();
  }

  const queueVisibilityControl = (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={accepting}
        onChange={(e) => handleQueueVisibilityToggle(e.target.checked)}
        disabled={loading}
        className="rounded border-border"
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-lg font-semibold text-muted border border-border">
              {(member.display_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-background">
            Photo
            <input
              ref={fileRef}
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
              <span className="text-xs text-amber-400">Hidden from queue</span>
            )}
          </div>
          {member.email && <p className="text-xs text-muted truncate">{member.email}</p>}
          {queueVisibilityControl}
          <p className="text-xs text-muted">
            Uncheck to hide the owner from the public barber picker (they can still manage the shop).
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
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/20 text-lg font-semibold text-muted border border-border">
            {(member.display_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-background">
          Photo
          <input
            ref={fileRef}
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
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              type="number"
              min={1}
              value={chairNumber}
              onChange={(e) => setChairNumber(e.target.value)}
              placeholder="Chair #"
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={accepting}
                onChange={(e) => setAccepting(e.target.checked)}
                className="rounded border-border"
              />
              Show on Choose your barber page
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="rounded bg-accent px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
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
              <span className="text-muted capitalize text-xs">({member.role})</span>
              {member.chair_number != null && (
                <span className="text-xs text-muted">Chair {member.chair_number}</span>
              )}
              {!accepting && (
                <span className="text-xs text-amber-400">Hidden from queue</span>
              )}
            </div>
            {member.email && <p className="text-xs text-muted truncate">{member.email}</p>}
            {member.role === "barber" && (
              <>
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
          </>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </li>
  );
}
