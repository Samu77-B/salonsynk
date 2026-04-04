/**
 * Remounts on client navigations so route transitions can animate without extra JS.
 * Opacity-only — no transform (transform breaks position:fixed descendants).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter-opacity">{children}</div>;
}
