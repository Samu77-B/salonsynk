/**
 * Salon member employment type labels (salon_members.employment_type).
 * DB values stay EMPLOYEE | RENTER; copy here is user-facing only.
 */

export type EmploymentType = "EMPLOYEE" | "RENTER";

export const EMPLOYMENT_TYPE_OPTIONS: Record<
  EmploymentType,
  { selectLabel: string; shortLabel: string; hint: string }
> = {
  EMPLOYEE: {
    selectLabel: "Employee (employed by salon)",
    shortLabel: "Employee",
    hint: "Employed staff. SalonSynk checkout and reports treat takings as the salon's.",
  },
  RENTER: {
    selectLabel: "Self-employed / renter",
    shortLabel: "Self-employed",
    hint: "Independent stylist or tech — they handle their own payments at the chair. Optional Stripe split and admin fee only if you use SalonSynk card checkout.",
  },
};

export function isEmploymentType(value: string): value is EmploymentType {
  return value === "EMPLOYEE" || value === "RENTER";
}

export function employmentTypeShortLabel(value: string | null | undefined): string {
  if (value === "RENTER") return EMPLOYMENT_TYPE_OPTIONS.RENTER.shortLabel;
  return EMPLOYMENT_TYPE_OPTIONS.EMPLOYEE.shortLabel;
}

export function employmentTypeHint(value: EmploymentType): string {
  return EMPLOYMENT_TYPE_OPTIONS[value].hint;
}
