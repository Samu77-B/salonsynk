"use client";

import { useRef, useState, useTransition } from "react";
import { uploadClientPhoto, deleteClientPhoto } from "./actions";
import type { PhotoSlot, ClientPhoto } from "./actions";

const SLOTS: { key: PhotoSlot; label: string }[] = [
  { key: "profile", label: "Profile photo" },
  { key: "photo_2", label: "Photo 2" },
  { key: "photo_3", label: "Photo 3" },
  { key: "photo_4", label: "Photo 4" },
];

function DefaultAvatar({ sex }: { sex: string | null }) {
  const src = sex === "male" ? "/imgs/male.svg" : "/imgs/female.svg";
  return (
    <img
      src={src}
      alt="Default avatar"
      className="h-full w-full object-cover opacity-40"
    />
  );
}

function PhotoSlotCard({
  clientId,
  slot,
  photo,
  sex,
  isProfile,
}: {
  clientId: string;
  slot: PhotoSlot;
  photo: ClientPhoto | undefined;
  sex: string | null;
  isProfile: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const displayUrl = deleted ? null : (localUrl ?? photo?.url ?? null);
  const busy = uploading || deleting;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const preview = URL.createObjectURL(file);
    setLocalUrl(preview);
    setDeleted(false);

    const fd = new FormData();
    fd.append("photo", file);

    startUpload(async () => {
      const result = await uploadClientPhoto(clientId, slot, fd);
      if (result.error) {
        setError(result.error);
        setLocalUrl(null);
      } else if (result.photo) {
        setLocalUrl(result.photo.url);
      }
      URL.revokeObjectURL(preview);
    });
  }

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      const result = await deleteClientPhoto(clientId, slot);
      if (result.error) {
        setError(result.error);
      } else {
        setLocalUrl(null);
        setDeleted(true);
      }
    });
  }

  const label = SLOTS.find((s) => s.key === slot)?.label ?? slot;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`
          group relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border
          bg-background/50 transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-50
          ${isProfile ? "h-36 w-36" : "h-28 w-28"}
        `}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={label}
            className="h-full w-full object-cover"
          />
        ) : isProfile ? (
          <DefaultAvatar sex={sex} />
        ) : (
          <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <svg className="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={handleFileChange}
        aria-label={`Upload ${label}`}
        className="hidden"
      />
      <span className={`text-xs ${isProfile ? "font-medium" : "text-muted"}`}>{label}</span>
      {displayUrl && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          Remove
        </button>
      )}
      {error && <p className="text-xs text-red-400 max-w-[8rem] text-center">{error}</p>}
    </div>
  );
}

export function ClientPhotos({
  clientId,
  photos,
  sex,
}: {
  clientId: string;
  photos: ClientPhoto[];
  sex: string | null;
}) {
  const photoMap = new Map(photos.map((p) => [p.slot, p]));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Photos</h2>
      <div className="flex flex-wrap gap-4 items-end">
        {SLOTS.map((s) => (
          <PhotoSlotCard
            key={s.key}
            clientId={clientId}
            slot={s.key}
            photo={photoMap.get(s.key)}
            sex={sex}
            isProfile={s.key === "profile"}
          />
        ))}
      </div>
    </section>
  );
}
