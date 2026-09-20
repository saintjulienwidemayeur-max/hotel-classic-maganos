/**
 * Brute-force protection for the access-code screen.
 *
 * A 4-digit code has only 10,000 possibilities, so guessing has to be slowed down:
 *   - per client   : 5 wrong codes in 15 minutes locks that client out
 *   - all clients  : 25 wrong codes in 15 minutes locks EVERYONE for a while
 *                    (covers attackers who rotate addresses)
 *
 * Attempts are kept in this server process's memory. That is exactly right for one
 * Node process (a hotel PC / mini server running `npm start`). On serverless hosting
 * such as Vercel each instance has its own memory, so treat it as best effort there.
 *
 * Limits do NOT protect a code that is easy to guess (0000, 1234, ...): the first
 * try succeeds. Choose codes that are not obvious if the app is reachable from outside.
 */

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_CLIENT = 5;
export const MAX_FAILURES_GLOBAL = 25;

interface GuardState {
  clients: Map<string, number[]>;
  global: number[];
}

// Stored on globalThis so dev-server hot reloads do not silently reset the counters.
const holder = globalThis as unknown as { __pinGuard?: GuardState };
const state: GuardState = (holder.__pinGuard ??= { clients: new Map(), global: [] });

function prune(list: number[], now: number): number[] {
  return list.filter((t) => now - t < WINDOW_MS);
}

export interface LockStatus {
  locked: boolean;
  /** Seconds until the lock ends (0 when not locked). */
  retryAfterSeconds: number;
  /** Wrong codes this client may still try before being locked. */
  attemptsLeft: number;
}

export function checkLock(clientKey: string, now = Date.now()): LockStatus {
  const mine = prune(state.clients.get(clientKey) ?? [], now);
  const all = prune(state.global, now);
  state.global = all;
  if (mine.length > 0) state.clients.set(clientKey, mine);
  else state.clients.delete(clientKey);

  const attemptsLeft = Math.max(0, MAX_FAILURES_PER_CLIENT - mine.length);
  const retryAfter = (list: number[], limit: number) =>
    list.length >= limit ? Math.max(1, Math.ceil((list[list.length - limit] + WINDOW_MS - now) / 1000)) : 0;

  const wait = Math.max(retryAfter(mine, MAX_FAILURES_PER_CLIENT), retryAfter(all, MAX_FAILURES_GLOBAL));
  return { locked: wait > 0, retryAfterSeconds: wait, attemptsLeft };
}

export function recordFailure(clientKey: string, now = Date.now()) {
  const mine = prune(state.clients.get(clientKey) ?? [], now);
  mine.push(now);
  state.clients.set(clientKey, mine);
  state.global = prune(state.global, now);
  state.global.push(now);
}

/** A correct code clears that client's own failures (the all-clients counter just ages out). */
export function recordSuccess(clientKey: string) {
  state.clients.delete(clientKey);
}

/**
 * Best-effort identity of the caller. X-Forwarded-For can be forged when the app is not
 * behind a proxy you control, which is why the all-clients limit exists as a backstop.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}

/** For tests only. */
export function resetPinGuard() {
  state.clients.clear();
  state.global = [];
}
