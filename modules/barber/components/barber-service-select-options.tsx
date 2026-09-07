"use client";

import {
  groupBarberServicesByCategory,
  type BarberServiceCategory,
  type BarberServiceWithCategory,
} from "@modules/barber/lib/service-categories";

type Props<T extends BarberServiceWithCategory> = {
  services: T[];
  categories?: BarberServiceCategory[];
  emptyLabel?: string;
  formatOption: (service: T) => string;
};

export function BarberServiceSelectOptions<T extends BarberServiceWithCategory>({
  services,
  categories = [],
  emptyLabel,
  formatOption,
}: Props<T>) {
  const groups = groupBarberServicesByCategory(services, categories);
  const useGroups = categories.length > 0;

  return (
    <>
      {emptyLabel != null ? <option value="">{emptyLabel}</option> : null}
      {useGroups
        ? groups.map((group) => {
            const options = group.services.map((service) => (
              <option key={service.id} value={service.id}>
                {formatOption(service)}
              </option>
            ));
            if (group.category) {
              return (
                <optgroup key={group.category.id} label={group.category.name}>
                  {options}
                </optgroup>
              );
            }
            if (options.length === 0) return null;
            return (
              <optgroup key="__uncategorised" label="Uncategorised">
                {options}
              </optgroup>
            );
          })
        : services.map((service) => (
            <option key={service.id} value={service.id}>
              {formatOption(service)}
            </option>
          ))}
    </>
  );
}
