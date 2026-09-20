/** Instant skeleton while a page's data loads (keeps navigation feeling fast). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Chargement">
      <div className="h-8 w-56 rounded bg-ink-100" />
      <div className="h-24 rounded-md bg-ink-100" />
      <div className="h-64 rounded-md bg-ink-100" />
    </div>
  );
}
