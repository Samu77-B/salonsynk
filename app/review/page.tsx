import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import Image from "next/image";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ salon?: string }>;
}) {
  const { salon: slug } = await searchParams;
  let salonName = "the salon";
  if (slug) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("salons")
        .select("name")
        .eq("slug", slug)
        .single();
      if (data?.name) salonName = data.name;
    } catch {
      // use default
    }
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="inline-block mb-2">
          <Image
          src="/salonsynk-logo.gif"
          alt="SalonSynk"
          width={560}
          height={160}
          className="mx-auto h-16 w-auto sm:h-20"
          sizes="(max-width: 640px) 128px, 160px"
          quality={95}
          priority
        />
        </Link>
        <h1 className="text-2xl font-bold">Thank you for visiting {salonName}</h1>
        <p className="text-muted-foreground">
          We hope you had a great experience. Your feedback helps us improve.
        </p>
        <p className="text-sm text-muted-foreground">
          You can leave a review on Google, or contact the salon directly to share your thoughts.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Back to SalonSynk
        </Link>
      </div>
    </main>
  );
}
