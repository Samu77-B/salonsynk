import { SmartDashboardShell } from "@/components/smart/dashboard/smart-dashboard-shell";

export default async function SmartDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SmartDashboardShell>{children}</SmartDashboardShell>;
}
