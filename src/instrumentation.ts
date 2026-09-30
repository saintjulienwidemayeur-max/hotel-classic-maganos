/**
 * Keep-alive for hosts that put idle apps to sleep (Render's free plan sleeps a service
 * after ~15 minutes without traffic). While the app is running, it calls its own public
 * address every 7 minutes, so it never counts as idle.
 *
 *   KEEP_ALIVE_URL      address to call (defaults to Render's RENDER_EXTERNAL_URL)
 *   KEEP_ALIVE_MINUTES  interval, default 7
 *   KEEP_ALIVE=off      switch it off
 *
 * A sleeping app cannot wake itself: if it is ever stopped for another reason (deploy,
 * crash), the first visit - or an external monitor calling /api/health - starts it again.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" && !process.env.KEEP_ALIVE_URL) return;
  if ((process.env.KEEP_ALIVE ?? "").toLowerCase() === "off") return;

  const base = (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
  if (!base) return;

  const holder = globalThis as unknown as { __keepAlive?: boolean };
  if (holder.__keepAlive) return;
  holder.__keepAlive = true;

  const minutes = Number(process.env.KEEP_ALIVE_MINUTES) > 0 ? Number(process.env.KEEP_ALIVE_MINUTES) : 7;

  const ping = async () => {
    try {
      const response = await fetch(`${base}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) console.warn(`[keep-alive] ${base}/api/health answered ${response.status}`);
    } catch (error) {
      console.warn(`[keep-alive] ping failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  setInterval(ping, minutes * 60_000);
  console.log(`[keep-alive] pinging ${base}/api/health every ${minutes} min`);
}
