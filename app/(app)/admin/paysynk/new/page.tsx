import Link from "next/link";
import { AdminNewPaysynkClientForm } from "./admin-new-paysynk-client-form";

export default function AdminNewPaysynkClientPage() {
  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/paysynk" className="text-sm text-muted hover:text-foreground">
          ← PaySynk
        </Link>
        <h1 className="text-2xl font-bold">Add PaySynk client</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Creates a store in the PaySynk app. Leave unapproved if they should stay off the public
        directory until you review them.
      </p>
      <AdminNewPaysynkClientForm />
    </div>
  );
}
