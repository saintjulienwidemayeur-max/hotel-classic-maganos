/** Hotel wordmark. `tone="light"` is for dark backgrounds. */
export function Brand({ tone = "dark", size = "md" }: { tone?: "dark" | "light"; size?: "md" | "lg" }) {
  const isLight = tone === "light";
  return (
    <div>
      <div
        className={`font-serif font-semibold leading-none tracking-tight ${size === "lg" ? "text-5xl" : "text-2xl"} ${
          isLight ? "text-white" : "text-ink-950"
        }`}
      >
        Magaños
      </div>
      <div className={`mt-1 text-sm ${isLight ? "text-brass-300" : "text-brass-700"}`}>Classic Plaza Hotel</div>
    </div>
  );
}
