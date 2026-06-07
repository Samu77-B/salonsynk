import Link from "next/link";
import { AdminNewBarberShopForm } from "./admin-new-barber-shop-form";

export default function AdminNewBarberShopPage() {
  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/barber-shops" className="text-muted hover:text-foreground text-sm">
          ← Barber shops
        </Link>
        <h1 className="text-2xl font-bold">Add barber shop</h1>
      </div>
      <AdminNewBarberShopForm />
    </div>
  );
}
