"use client";

import { useCallback, useState } from "react";
import { jsPDF } from "jspdf";
import type { ReportPdfPayload } from "./report-pdf-types";

const MM_LINE_10PT = 4.6;

function safeFilenamePart(name: string): string {
  return name
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "salon";
}

function buildPdf(payload: ReportPdfPayload): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (mm: number) => {
    if (y + mm > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string, size = 14) => {
    ensureSpace(size * 0.5 + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.45) + 3;
  };

  const body = (text: string, size = 10, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, maxW - indent);
    for (const line of lines) {
      ensureSpace(MM_LINE_10PT);
      doc.text(line, margin + indent, y);
      y += MM_LINE_10PT;
    }
  };

  const muted = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(4);
      doc.text(line, margin, y);
      y += 4;
    }
  };

  heading("SalonSynk performance report", 16);
  muted(`Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`);
  y += 2;

  heading(payload.salonName, 12);
  body(`${payload.rangeLabel} · ${payload.dateRangeLabel}`);
  y += 3;

  heading("Summary", 12);
  body(`${payload.salesLabel}: ${payload.totalSales}`);
  muted(payload.salesDelta);
  body(`Completed appointments: ${payload.completedAppointments}`);
  muted(payload.completedDelta);
  body(`Haircuts completed: ${payload.haircuts}`);
  muted(payload.haircutsDelta);
  body(`Completion rate: ${payload.completionRate}`);
  muted(payload.completionDelta);
  y += 2;

  heading("Top services (completed)", 12);
  if (payload.topServices.length === 0) {
    body("No completed services in this period.");
  } else {
    for (const s of payload.topServices) {
      body(`${s.name} — ${s.count} completed, ${s.sales}`);
    }
  }
  y += 2;

  heading("Top stylists (sales ledger)", 12);
  if (payload.topStylists.length === 0) {
    body("No sales in this period.");
  } else {
    for (const s of payload.topStylists) {
      body(`${s.name} — ${s.count} transactions, ${s.sales}`);
    }
  }
  y += 2;

  if (payload.includeProductSales) {
    heading("Retail / product sales (ledger)", 12);
    if (payload.totalProductSales) {
      body(`Product-tagged sales: ${payload.totalProductSales}`);
      if (payload.productSalesDelta) muted(payload.productSalesDelta);
    }
    if (!payload.topProductsRetail?.length) {
      body("No product-tagged transactions in this period.");
    } else {
      for (const s of payload.topProductsRetail) {
        body(`${s.name} — ${s.count} line(s), ${s.sales}`);
      }
    }
    y += 2;
  }

  heading("Attendance", 12);
  body(`Total bookings: ${payload.totalBookings}`);
  body(`No-shows: ${payload.noShows}`);
  body(`Cancellations: ${payload.canceled}`);
  y += 4;

  muted(
    "Sales and stylist figures reflect successful Stripe payments. Bookings, completion, no-shows, and cancellations reflect appointment records in SalonSynk.",
  );

  return doc;
}

export function ReportPdfDownload({
  payload,
  disabled,
}: {
  payload: ReportPdfPayload;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const onDownload = useCallback(() => {
    setBusy(true);
    try {
      const doc = buildPdf(payload);
      const part = safeFilenamePart(payload.salonName);
      const stamp = new Date().toISOString().slice(0, 10);
      const rangePart =
        payload.range === "custom" && payload.customFromYmd && payload.customToYmd
          ? `custom-${payload.customFromYmd}-${payload.customToYmd}`
          : `${payload.range}-${stamp}`;
      doc.save(`salonsynk-report-${part}-${rangePart}.pdf`);
    } finally {
      setBusy(false);
    }
  }, [payload]);

  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={disabled || busy}
      className="rounded-md border border-border bg-white/10 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Preparing…" : "Download PDF"}
    </button>
  );
}
