export type GymsynkAvailability = "ok" | "unconfigured" | "unavailable";

export type GymsynkResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; availability: Exclude<GymsynkAvailability, "ok"> };

export type GymsynkTenant = {
  id: string;
  name: string;
  slug: string;
  createdAt: string | null;
  owner: { name: string; email: string } | null;
  loginUrl: string;
  joinUrl: string;
  embedUrl: string;
};

export type GymsynkCreateTenantInput = {
  gymName: string;
  ownerName: string;
  email: string;
  password?: string;
  slug?: string;
};

export type GymsynkCreateTenantResult = {
  tenant: GymsynkTenant;
  temporaryPassword?: string;
};
