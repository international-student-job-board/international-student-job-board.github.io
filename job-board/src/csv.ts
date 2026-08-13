// Reading and writing the one CSV the site runs on.
//
// A small RFC-4180 implementation rather than a library: this is the only CSV
// format involved, and a parser dependency cost more in bundle size than the
// whole feature. It handles the two things that actually appear in the file —
// commas inside quoted fields (addresses, taglines) and doubled quotes as an
// escape.

/** CSV text -> one object per row, keyed by the header names. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((cells) => cells.some((c) => c.trim()))
    .map((cells) =>
      header.reduce<Record<string, string>>((obj, name, i) => {
        obj[name.trim()] = cells[i] ?? '';
        return obj;
      }, {})
    );
}

/** CSV text -> raw rows of cells, header included. */
export function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * One value, quoted only when it has to be.
 *
 * Quoting everything would be valid too, but this file is read and edited by
 * hand as often as by code, and a wall of quotes around one-word cells makes
 * that harder than it needs to be.
 */
export function escapeCell(value: string): string {
  const text = (value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One object -> one CSV line, in the column order given. */
export function toCsvRow(record: Record<string, string>, columns: string[]): string {
  return columns.map((name) => escapeCell(record[name] ?? '')).join(',');
}


// ---- Reading one cell's value ---------------------------------------------

const isTruthy = (value: string) =>
  ['yes', 'true', '1', 'y'].includes((value ?? '').trim().toLowerCase());

const isFalsy = (value: string) =>
  ['no', 'false', '0', 'n'].includes((value ?? '').trim().toLowerCase());

/**
 * yes / no / nobody said. Anything unreadable counts as nobody said.
 *
 * Both files write these by hand and by export, so both "Yes" and "True" turn
 * up. Blank is deliberately not "no": the two migration columns are filled in
 * as each company is checked, and an empty cell means unchecked.
 */
export function triState(value: string): boolean | undefined {
  if (isTruthy(value)) return true;
  if (isFalsy(value)) return false;
  return undefined;
}

/**
 * A cell holding several values.
 *
 * Semicolons, pipes and comma-space are all accepted because all three turn up
 * in files this size, and guessing wrong turns "SaaS, Fintech" into one
 * industry named "SaaS, Fintech" that matches no filter and appears in the list
 * once, looking like a typo rather than a parsing bug.
 */
export const splitList = (value: string) =>
  (value ?? '')
    .split(/[;|]|,\s/)
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * The 6-digit codes in a cell, however they are separated.
 *
 * Pulling them out by shape rather than splitting on a delimiter means
 * "261312|261313", "261312, 261313" and "ANZSCO 261312 / 261313" all read the
 * same, and stray words never become codes.
 */
export const anzscoCodes = (value: string) =>
  Array.from(new Set((value ?? '').match(/\b\d{6}\b/g) ?? []));
