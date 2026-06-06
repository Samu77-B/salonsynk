import { redirect } from "next/navigation";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

export default async function BarberDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shopContext = await getCurrentUserShop();
  if (!shopContext) redirect("/onboarding");

  return <>{children}</>;
}
