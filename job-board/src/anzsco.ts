// The full ANZSCO occupation list (public/anzsco_codes.tsv), used to pick an
// occupation when a role is being posted. It lives in public/ and is fetched on
// demand rather than bundled: 1,400-odd rows would be dead weight in the bundle
// for every visitor to the job board, and only the two posting flows need it.

const TSV_URL = `${process.env.PUBLIC_URL || ''}/anzsco_codes.tsv`;

export interface AnzscoOccupation {
  code: string;
  title: string;
}

// The file separates the code from the title with a tab on most rows but with
// spaces on a few, so this matches a run of whitespace rather than a tab. Rows
// that don't start with a 6-digit code (the header) are skipped.
const ROW = /^(\d{6})\s+(.+?)\s*$/;

export function parseAnzscoTsv(text: string): AnzscoOccupation[] {
  const rows: AnzscoOccupation[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ROW);
    if (match) rows.push({ code: match[1], title: match[2] });
  }
  return rows;
}

// Cached across mounts so opening the picker a second time is instant. A failed
// fetch clears the cache so the next attempt retries rather than resolving to
// the same error forever.
let pending: Promise<AnzscoOccupation[]> | null = null;

export function loadAnzscoCodes(): Promise<AnzscoOccupation[]> {
  if (!pending) {
    pending = fetch(TSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the ANZSCO list (${res.status})`);
        return res.text();
      })
      .then(parseAnzscoTsv)
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/**
 * Occupations matching a query, best first: an exact code, then codes starting
 * with the digits typed, then titles starting with the words typed, then titles
 * containing them. Someone who knows the code gets it immediately; someone
 * describing the job still finds it.
 */
export function searchAnzsco(
  rows: AnzscoOccupation[],
  query: string,
  limit = Number.MAX_SAFE_INTEGER
): AnzscoOccupation[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows.slice(0, limit);

  const rank = (row: AnzscoOccupation): number => {
    const title = row.title.toLowerCase();
    if (row.code === q) return 0;
    if (row.code.startsWith(q)) return 1;
    if (title.startsWith(q)) return 2;
    if (title.includes(q)) return 3;
    return -1;
  };

  return rows
    .map((row) => ({ row, score: rank(row) }))
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || a.row.code.localeCompare(b.row.code))
    .slice(0, limit)
    .map((hit) => hit.row);
}

/** The stored form of a choice: "261313 Software Engineer". */
export const anzscoLabel = (row: AnzscoOccupation) => `${row.code} ${row.title}`;
