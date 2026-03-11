import Link from "next/link";
import { AdminNewSalonForm } from "./admin-new-salon-form";

export default function AdminNewSalonPage() {
  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/salons" className="text-muted hover:text-foreground text-sm">
          ← Salons
        </Link>
        <h1 className="text-2xl font-bold">Add salon</h1>
      </div>
      <AdminNewSalonForm />
    </div>
  );
}
