"use client";

import { SignaturePad } from "./signature-pad";

export type ColourWaiverValue = {
  agreed: boolean;
  signerName: string;
  signatureData: string;
};

export function ColourWaiverForm({
  salonName,
  waiverText,
  value,
  onChange,
}: {
  salonName: string;
  waiverText: string;
  value: ColourWaiverValue;
  onChange: (next: ColourWaiverValue) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm font-medium">Colour patch test waiver — {salonName}</p>
      <p className="text-xs text-muted">
        Because you declined a patch test, you must e-sign this waiver before a colour booking can go ahead.
      </p>
      <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed">
        {waiverText}
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.agreed}
          onChange={(e) => onChange({ ...value, agreed: e.target.checked })}
          required
        />
        <span>I have read this waiver and I agree to sign it electronically</span>
      </label>
      <div>
        <label className="mb-1 block text-sm font-medium">Full legal name</label>
        <input
          type="text"
          value={value.signerName}
          onChange={(e) => onChange({ ...value, signerName: e.target.value })}
          required
          autoComplete="name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <SignaturePad
        value={value.signatureData}
        onChange={(signatureData) => onChange({ ...value, signatureData })}
      />
    </div>
  );
}
