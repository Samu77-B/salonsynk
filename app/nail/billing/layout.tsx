export default function NailBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell-dark min-h-screen flex flex-col overflow-x-hidden bg-canvas text-foreground">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col text-foreground">
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
