export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          SalonSynk
        </h1>
        <p className="text-xl text-muted">
          No commissions. Just Synk.
        </p>
        <p className="text-muted text-sm max-w-md mx-auto">
          Flat-fee salon management for UK salons and barbers. One diary, your team, your clients — without the cut.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition"
          >
            Get started
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-white/5 transition"
          >
            Book a demo
          </a>
        </div>
        <p className="text-xs text-muted pt-8">
          A product of Paradigm Digital Studio
        </p>
      </div>
    </main>
  );
}
