import Link from "next/link";
import { AdminNewNailSalonForm } from "./admin-new-nail-salon-form";

export default function AdminNewNailSalonPage() {
  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/nail-salons" className="text-muted hover:text-foreground text-sm">
          ← Nail salons
        </Link>
        <h1 className="text-2xl font-bold">Add salon</h1>
      </div>
      <AdminNewNailSalonForm />
    </div>
  );
}
