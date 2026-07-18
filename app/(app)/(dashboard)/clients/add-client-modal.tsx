"use client";

import { useLayoutEffect, useRef } from "react";
import { DashboardModalShell, dashboardModalPanelClass } from "@/components/dashboard/modal";
import { ClientForm } from "./client-form";

export function AddClientModal({
  salonId,
  onClose,
}: {
  salonId: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <DashboardModalShell open onClose={onClose} ariaLabelledBy="add-client-title">
      <div
        ref={panelRef}
        className={dashboardModalPanelClass("max-w-md lg:max-w-lg")}
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
    </DashboardModalShell>
  );
}
