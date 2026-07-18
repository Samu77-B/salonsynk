"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Shared overlay: centered horizontally, slightly above vertical center. */
export const dashboardModalOverlayClass =
  "fixed inset-0 flex items-center justify-center overflow-y-auto p-4 pt-[max(1rem,6vh)] pb-[max(1rem,18vh)] sm:p-6 sm:pt-[max(1.5rem,8vh)] sm:pb-[max(1.5rem,20vh)]";

export const dashboardModalBackdropClass =
  "absolute inset-0 cursor-default backdrop-blur-lg bg-black/20";

export function dashboardModalPanelClass(maxWidthClass = "max-w-md") {
  return `relative z-10 flex max-h-[min(90dvh,calc(100vh-2rem))] w-full min-w-0 ${maxWidthClass} shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl ring-1 ring-border/80`;
}

function useDashboardModalBodyLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function DashboardModalShell({
  open,
  onClose,
  children,
  ariaLabelledBy,
  zIndexClass = "z-[100]",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabelledBy?: string;
  zIndexClass?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDashboardModalBodyLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`${dashboardModalOverlayClass} ${zIndexClass}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <button
        type="button"
        className={dashboardModalBackdropClass}
        aria-label="Close dialog"
        onClick={onClose}
      />
      {children}
    </div>,
    document.body
  );
}

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
  const headingId = titleId ?? "dashboard-modal-title";

  return (
    <DashboardModalShell open={open} onClose={onClose} ariaLabelledBy={headingId}>
      <div
        className={dashboardModalPanelClass(maxWidthClass)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
          <h2 id={headingId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </DashboardModalShell>
  );
}
