export type BarberServiceCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type BarberServiceWithCategory = {
  id: string;
  name: string;
  duration_minutes: number;
  price_minor: number;
  category_id?: string | null;
};

export type BarberServiceCategoryGroup<T> = {
  category: BarberServiceCategory | null;
  services: T[];
};

export function groupBarberServicesByCategory<T extends { category_id?: string | null }>(
  services: T[],
  categories: BarberServiceCategory[],
  options?: { includeEmptyCategories?: boolean }
): BarberServiceCategoryGroup<T>[] {
  const includeEmpty = options?.includeEmptyCategories === true;
  const uncategorised: T[] = [];
  const byCat = new Map<string, T[]>();

  for (const service of services) {
    const catId = service.category_id?.trim();
    if (catId) {
      const list = byCat.get(catId) ?? [];
      list.push(service);
      byCat.set(catId, list);
    } else {
      uncategorised.push(service);
    }
  }

  const groups: BarberServiceCategoryGroup<T>[] = [];
  const known = new Set(categories.map((c) => c.id));

  for (const category of categories) {
    const list = byCat.get(category.id) ?? [];
    if (list.length > 0 || includeEmpty) {
      groups.push({ category, services: list });
    }
  }

  const orphans: T[] = [];
  for (const [id, list] of byCat) {
    if (!known.has(id)) orphans.push(...list);
  }

  const leftover = [...uncategorised, ...orphans];
  if (leftover.length > 0 || groups.length === 0) {
    groups.push({ category: null, services: leftover });
  }

  return groups;
}
