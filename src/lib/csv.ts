/**
 * Minimal CSV writer for the report export.
 *
 * - Every cell is quoted and inner quotes are doubled (RFC 4180).
 * - A UTF-8 byte-order mark is added so Excel shows accents (Magaños, José) correctly.
 * - Formula injection guard: guests type their own name/address/notes, and a cell that
 *   starts with = + - @ can run as a formula when the file is opened in a spreadsheet.
 *   Such text gets a leading apostrophe. Plain phone numbers and numbers are left alone.
 */
const STARTS_LIKE_FORMULA = /^[=+\-@\t\r]/;
const PLAIN_NUMBER_OR_PHONE = /^\+?[\d\s().-]+$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (STARTS_LIKE_FORMULA.test(text) && !PLAIN_NUMBER_OR_PHONE.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
