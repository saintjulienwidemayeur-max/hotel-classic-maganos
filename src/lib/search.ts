/**
 * Turns what someone typed in a search box into safe LIKE tokens:
 *   - accents are stripped ("José" -> "jose") to match the accent-stripped search_text columns,
 *   - LIKE wildcards (% _ \) are escaped so they are searched for literally,
 *   - at most six words are used.
 * Every token must appear somewhere in the row's search_text (AND logic).
 */
export function toSearchTokens(query: string): string[] {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[\\%_]/g, (char) => `\\${char}`))
    .filter(Boolean)
    .slice(0, 6);
}
