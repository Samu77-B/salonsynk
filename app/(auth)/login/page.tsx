import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block mb-6">
            <Image src="/salonsynk_logo.png" alt="SalonSynk" width={280} height={80} className="mx-auto h-16 w-auto sm:h-20 md:h-24" priority />
          </Link>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-muted text-sm mt-1">Welcome back to SalonSynk</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
