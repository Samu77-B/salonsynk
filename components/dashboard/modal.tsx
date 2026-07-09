"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function DashboardModal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "max-w-md",
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidthClass?: string;
  titleId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const headingId = titleId ?? "dashboard-modal-title";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default backdrop-blur-lg bg-black/20"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(90dvh,calc(100vh-2rem))] w-full min-w-0 ${maxWidthClass} shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl ring-1 ring-border/80`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
          <h2 id={headingId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          <div className={description ? "mt-4" : "mt-4"}>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
