"use client";

import { useState } from "react";

type Props = {
  joinUrl: string;
  joinPath: string;
  salonName: string;
};

export function WalkInQrPanel({ joinUrl, joinPath, salonName }: Props) {
  const [copied, setCopied] = useState(false);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col sm:flex-row gap-4 items-center max-w-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSrc}
        alt={`QR code to join the walk-in queue at ${salonName}`}
        width={110}
        height={110}
        className="rounded-lg border border-border bg-white shrink-0"
      />
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-sm font-medium">Walk-in QR code</p>
        <p className="text-xs text-muted mt-1">Print or display at reception — clients scan to join the queue.</p>
        <p className="text-xs text-muted mt-2 truncate font-mono">{joinPath}</p>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
