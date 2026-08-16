export type PaysynkSignupStatus = "pending" | "approved" | "rejected";

export type PaysynkAvailability = "ok" | "unavailable" | "unconfigured";

export type PaysynkOverview = {
  platform: string;
  health: unknown;
  stores: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  ordersThisMonth: number;
  revenueThisMonthMinor: number;
};

export type PaysynkSignup = {
  id: string;
  platform: string;
  name: string;
  slug: string;
  shopUrl: string;
  signupStatus: PaysynkSignupStatus;
  adminNotes: string | null;
  paymentsActive: boolean;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type PaysynkCreateSignupInput = {
  fullName: string;
  storeName: string;
  email: string;
  password?: string;
  approve?: boolean;
};

export type PaysynkCreateSignupResult = {
  signup: PaysynkSignup;
  temporaryPassword?: string;
};

export type PaysynkPatchSignupInput = {
  status?: PaysynkSignupStatus;
  adminNotes?: string;
  name?: string;
};

export type PaysynkResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; availability: PaysynkAvailability };
