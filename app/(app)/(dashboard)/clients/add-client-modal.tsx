"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClientForm } from "./client-form";

export function AddClientModal({
  salonId,
  onClose,
}: {
  salonId: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    panel.style.opacity = "0";
    panel.style.transform = "translateY(-28px)";
    let cleanupTimeout = 0;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        panel.style.transition =
          "opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)";
        panel.style.opacity = "1";
        panel.style.transform = "translateY(0)";
        cleanupTimeout = window.setTimeout(() => {
          panel.style.transition = "";
          panel.style.removeProperty("opacity");
          panel.style.removeProperty("transform");
        }, 400);
      });
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      clearTimeout(cleanupTimeout);
      panel.style.transition = "";
      panel.style.removeProperty("opacity");
      panel.style.removeProperty("transform");
    };
  }, []);

  return mounted
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-client-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default backdrop-blur-lg"
            aria-label="Close add client dialog"
            onClick={onClose}
          />
          <div
            ref={panelRef}
            className="relative z-10 flex max-h-[min(90dvh,calc(100vh-2rem))] w-full min-w-0 max-w-md shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl ring-1 ring-border/80 lg:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
              <h2 id="add-client-title" className="text-lg font-semibold mb-4">
                Add client
              </h2>
              <ClientForm
                salonId={salonId}
                inlineOnCreate
                onCancel={onClose}
                onCreated={onClose}
              />
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
