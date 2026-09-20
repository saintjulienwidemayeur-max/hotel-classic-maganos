import { createHash, timingSafeEqual } from "node:crypto";
import { PIN_LENGTH } from "./constants";

/**
 * Access codes (PINs) for the two ways into the app.
 *
 *   reception -> registers guests, checks them in and out
 *   admin     -> reports, guest directory, rooms, rates and settings
 *
 * Where a code lives
 *   * .env.local (RECEPTION_PIN / ADMIN_PIN) is the code the app starts with.
 *   * As soon as the administrator changes a code on the Settings screen, a
 *     salted hash of the new code is stored in the database (app_settings) and
 *     the value in .env.local is IGNORED for that role.
 *
 * Nothing but the hash ever leaves the server: the browser sends the 4 digits,
 * the server hashes them with a server-only pepper and asks the database which
 * role - if any - that hash belongs to.
 */
export type AccessRole = "admin" | "reception";

interface RoleAccess {
  pin: string;
  email: string;
  password: string;
}

export interface AccessConfig {
  admin: RoleAccess;
  reception: RoleAccess;
}

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

/** Codes that are among the first things anyone would try. */
export const COMMON_CODES = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "1212", "2580", "1122", "1010",
]);

export const isPinShaped = (pin: string) => PIN_PATTERN.test(pin);

let warned = false;

/**
 * Reads and validates the access settings. Returns a list of problems (variable
 * NAMES only, never values) instead of throwing, so the login page can fail politely.
 */
export function getAccessConfig(): { config: AccessConfig | null; problems: string[] } {
  const read = (name: string) => (process.env[name] ?? "").trim();
  const problems: string[] = [];

  const values = {
    ADMIN_PIN: read("ADMIN_PIN"),
    ADMIN_EMAIL: read("ADMIN_EMAIL"),
    ADMIN_PASSWORD: read("ADMIN_PASSWORD"),
    RECEPTION_PIN: read("RECEPTION_PIN"),
    RECEPTION_EMAIL: read("RECEPTION_EMAIL"),
    RECEPTION_PASSWORD: read("RECEPTION_PASSWORD"),
  };

  for (const [name, value] of Object.entries(values)) {
    if (!value) problems.push(`${name} is empty`);
  }
  for (const name of ["ADMIN_PIN", "RECEPTION_PIN"] as const) {
    if (values[name] && !PIN_PATTERN.test(values[name])) problems.push(`${name} must be exactly ${PIN_LENGTH} digits`);
  }
  for (const name of ["ADMIN_EMAIL", "RECEPTION_EMAIL"] as const) {
    if (values[name] && !values[name].includes("@")) problems.push(`${name} is not an email address`);
  }
  if (values.ADMIN_PIN && values.ADMIN_PIN === values.RECEPTION_PIN) problems.push("ADMIN_PIN and RECEPTION_PIN must be different");
  if (values.ADMIN_EMAIL && values.ADMIN_EMAIL.toLowerCase() === values.RECEPTION_EMAIL.toLowerCase()) {
    problems.push("ADMIN_EMAIL and RECEPTION_EMAIL must be different accounts");
  }

  if (problems.length > 0) return { config: null, problems };

  if (!warned) {
    warned = true;
    for (const [label, pin] of [["ADMIN_PIN", values.ADMIN_PIN], ["RECEPTION_PIN", values.RECEPTION_PIN]]) {
      if (COMMON_CODES.has(pin)) {
        console.warn(
          `[access] ${label} is a very common code. Fine on a private front-desk network; ` +
            `change it on the Settings screen before the app is reachable from the internet.`
        );
      }
    }
  }

  return {
    config: {
      admin: { pin: values.ADMIN_PIN, email: values.ADMIN_EMAIL, password: values.ADMIN_PASSWORD },
      reception: { pin: values.RECEPTION_PIN, email: values.RECEPTION_EMAIL, password: values.RECEPTION_PASSWORD },
    },
    problems: [],
  };
}

/**
 * Server-only secret mixed into every stored code hash, so a copy of the database
 * alone cannot be used to work out a 4-digit code. PIN_PEPPER when set, otherwise
 * the administrator account password (which is already server-only and required).
 */
function pepper(): string {
  return (process.env.PIN_PEPPER ?? "").trim() || (process.env.ADMIN_PASSWORD ?? "").trim();
}

/** The value stored in app_settings for a code. Never reversible to the code itself. */
export function hashPin(pin: string): string {
  return createHash("sha256").update(`${pepper()}:${pin}`).digest("hex");
}

/** Constant-time string comparison (hashing first makes both sides the same length). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Which role does this code open, using the codes from .env.local?
 * Roles listed in `overridden` have a code stored in the database instead, so the
 * environment value must no longer be accepted for them.
 * Both codes are always compared, so timing reveals nothing.
 */
export function matchPin(pin: string, config: AccessConfig, overridden: AccessRole[] = []): AccessRole | null {
  const isAdmin = safeEqual(pin, config.admin.pin) && !overridden.includes("admin");
  const isReception = safeEqual(pin, config.reception.pin) && !overridden.includes("reception");
  if (isAdmin) return "admin";
  if (isReception) return "reception";
  return null;
}
