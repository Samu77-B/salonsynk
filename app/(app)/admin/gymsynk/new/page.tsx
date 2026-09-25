import Link from "next/link";
import { AdminNewGymsynkClientForm } from "./admin-new-gymsynk-client-form";

export default function AdminNewGymsynkClientPage() {
  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/gymsynk" className="text-sm text-muted hover:text-foreground">
          ← GymSynk
        </Link>
        <h1 className="text-2xl font-bold">Add GymSynk client</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Creates the gym and an owner account in GymSynk. Leave the password blank to generate one.
        To use this gym as the public demo, copy its join and schedule links onto the gymsynk.net
        marketing page after it exists.
      </p>
      <AdminNewGymsynkClientForm />
    </div>
  );
}
