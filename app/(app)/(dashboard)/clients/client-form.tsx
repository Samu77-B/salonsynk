"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClientAction, uploadClientPhoto } from "./actions";
import { DefaultAvatar } from "./client-photos";

const inputClass =
  "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60";

export function ClientForm({
  salonId,
  clientId,
  initial,
  /** On the clients list: reset form and refresh instead of navigating away. */
  inlineOnCreate,
}: {
  salonId: string;
  clientId?: string;
  initial?: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    sex?: string | null;
    marketing_opt_in?: boolean;
  };
  inlineOnCreate?: boolean;
}) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [marketingOptIn, setMarketingOptIn] = useState(initial?.marketing_opt_in !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  const showCancel = Boolean(clientId) || !inlineOnCreate;
  const isCreate = !clientId;

  function clearProfileSelection() {
    if (profilePreview) URL.revokeObjectURL(profilePreview);
    setProfilePreview(null);
    setProfileFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function handleProfilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (profilePreview) URL.revokeObjectURL(profilePreview);
    setProfileFile(file);
    setProfilePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (clientId) {
      const { updateClientAction } = await import("./actions");
      const result = await updateClientAction(clientId, {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
        sex: sex || null,
        marketing_opt_in: marketingOptIn,
      });
      if (result.error) setError(result.error);
      else router.push(`/clients/${clientId}`);
    } else {
      const result = await createClientAction({
        salonId,
        name: name || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        sex: sex || null,
        marketing_opt_in: marketingOptIn,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      const newId = result.clientId;
      if (!newId) {
        setError("Client was created but we could not read the new id. Add the photo from the client page.");
        setLoading(false);
        if (!inlineOnCreate) router.push("/clients");
        else router.refresh();
        return;
      }

      if (profileFile) {
        const fd = new FormData();
        fd.append("photo", profileFile);
        try {
          const up = await uploadClientPhoto(newId, "profile", fd);
          if (up.error) {
            setError(`Client saved. Profile photo failed: ${up.error}`);
            setLoading(false);
            if (!inlineOnCreate) router.push(`/clients/${newId}`);
            else {
              setName("");
              setEmail("");
              setPhone("");
              setNotes("");
              setSex("");
              setMarketingOptIn(true);
              clearProfileSelection();
              router.refresh();
            }
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setError(`Client saved. Profile photo failed: ${msg}`);
          setLoading(false);
          if (!inlineOnCreate) router.push(`/clients/${newId}`);
          else {
            setName("");
            setEmail("");
            setPhone("");
            setNotes("");
            setSex("");
            setMarketingOptIn(true);
            clearProfileSelection();
            router.refresh();
          }
          return;
        }
      }

      clearProfileSelection();
      if (inlineOnCreate) {
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
        setSex("");
        setMarketingOptIn(true);
        router.refresh();
      } else {
        router.push(`/clients/${newId}`);
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isCreate && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={loading}
              className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background/50 transition-colors hover:border-accent/60 hover:bg-accent/5 disabled:opacity-50"
            >
              {profilePreview ? (
                <Image
                  src={profilePreview}
                  alt="Profile preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <DefaultAvatar sex={sex === "male" ? "male" : sex === "female" ? "female" : null} />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Choose photo
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleProfilePick}
              aria-label="Profile photo"
              className="hidden"
            />
            {profileFile && (
              <button
                type="button"
                onClick={clearProfileSelection}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0 sm:pt-1">
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="mt-1 text-xs text-muted">
              Optional. Uploaded when you save. JPEG, PNG, WebP or HEIC, up to 5 MB. Default icon follows sex below.
            </p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="client-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="client-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="client-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="client-phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id="client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="client-sex" className="mb-1 block text-sm font-medium">
            Sex
          </label>
          <select
            id="client-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={inputClass}
          >
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="client-notes" className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Colour history, preferences, or anything your team should know."
          className={`${inputClass} min-h-[4.5rem] resize-y`}
        />
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 rounded border-border"
        />
        <span className="text-sm">
          <span className="font-medium">Marketing emails</span>
          <span className="block text-muted text-xs mt-0.5">
            Client agrees to receive promotional campaigns from this salon. They can unsubscribe from any campaign email.
          </span>
        </span>
      </label>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {showCancel && (
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Saving…" : clientId ? "Save" : "Add client"}
        </button>
      </div>
    </form>
  );
}
