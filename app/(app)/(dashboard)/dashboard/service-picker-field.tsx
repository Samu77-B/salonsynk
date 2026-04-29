"use client";

import { useMemo, useState } from "react";

type Service = { id: string; name: string; duration_minutes: number };

function durationForService(
  s: Service,
  stylistId: string,
  stylistOverrides?: Record<string, Record<string, number>>
) {
  const ov = stylistId ? stylistOverrides?.[stylistId]?.[s.id] : undefined;
  return ov ?? s.duration_minutes;
}

type ServicePickerFieldProps = {
  id: string;
  services: Service[];
  stylistId: string;
  stylistOverrides?: Record<string, Record<string, number>>;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Shown under the label — e.g. combined duration */
  hint?: string;
};

export function ServicePickerField({
  id,
  services,
  stylistId,
  stylistOverrides = {},
  selectedIds,
  onSelectedIdsChange,
  hint,
}: ServicePickerFieldProps) {
  const [serviceSearch, setServiceSearch] = useState("");
  const [pickerFocused, setPickerFocused] = useState(false);

  const availableServices = useMemo(
    () => services.filter((s) => !selectedIds.includes(s.id)),
    [services, selectedIds],
  );

  const filteredServices = useMemo(() => {
    const raw = serviceSearch.trim().toLowerCase();
    if (!raw.length) return availableServices.slice(0, 24);
    return availableServices.filter((s) => (s.name ?? "").toLowerCase().includes(raw)).slice(0, 30);
  }, [availableServices, serviceSearch]);

  const addService = (svc: Service) => {
    onSelectedIdsChange([...selectedIds, svc.id]);
    setServiceSearch("");
  };

  const removeService = (serviceId: string) => {
    onSelectedIdsChange(selectedIds.filter((x) => x !== serviceId));
  };

  return (
    <div className="relative z-50 space-y-2">
      <label className="block text-sm font-medium mb-1" htmlFor={id}>
        Services
      </label>
      {hint ? <p className="text-xs text-muted-foreground mb-2">{hint}</p> : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((sid) => {
            const s = services.find((x) => x.id === sid);
            if (!s) return null;
            const dur = durationForService(s, stylistId, stylistOverrides);
            const ov = stylistId ? stylistOverrides[stylistId]?.[s.id] : undefined;
            return (
              <span
                key={sid}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs"
              >
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  ({dur} min){ov !== undefined ? " · custom" : ""}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => removeService(sid)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="relative">
        <input
          id={id}
          type="search"
          autoComplete="off"
          placeholder={availableServices.length === 0 ? "All catalogue services selected" : "Type to search services…"}
          disabled={availableServices.length === 0}
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          onFocus={() => setPickerFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setPickerFocused(false), 150);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        />

        {pickerFocused && filteredServices.length > 0 ? (
          <ul
            role="listbox"
            aria-label="Matching services"
            className="absolute left-0 right-0 z-[60] mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-lg"
          >
            {filteredServices.map((s) => {
              const dur = durationForService(s, stylistId, stylistOverrides);
              const ov = stylistId ? stylistOverrides[stylistId]?.[s.id] : undefined;
              return (
                <li key={s.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addService(s);
                    }}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {dur} min
                      {ov !== undefined ? " · custom timing" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pickerFocused &&
          serviceSearch.trim().length > 0 &&
          availableServices.length > 0 &&
          filteredServices.length === 0 ? (
            <p className="absolute left-0 right-0 mt-1 text-xs text-muted-foreground">
              No matches.
            </p>
          ) : null}
      </div>
    </div>
  );
}
