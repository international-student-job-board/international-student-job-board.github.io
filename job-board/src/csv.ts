// Reading and writing the one CSV the site runs on.

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

/** One value, quoted only when it has to be. */
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

/** yes / no / nobody said. */
export function triState(value: string): boolean | undefined {
  if (isTruthy(value)) return true;
  if (isFalsy(value)) return false;
  return undefined;
}

/** A cell holding several values. */
export const splitList = (value: string) =>
  (value ?? '')
    .split(/[;|]|,\s/)
    .map((v) => v.trim())
    .filter(Boolean);

/** The 6-digit codes in a cell, however they are separated. */
/**
 * A cell holding several names.
 *
 * Only ";" and "|" separate, never a comma: an occupation title routinely
 * contains one — "Advertising, Public Relations and Sales Managers" — and
 * splitting on it tears a single name into two.
 */
export const splitNames = (value: string) =>
  (value ?? '')
    .split(/[;|]/)
    .map((v) => v.trim())
    .filter(Boolean);

/** The four-digit unit-group codes in a cell, in the order they appear. */
export const unitGroupCodes = (value: string) =>
  Array.from(new Set((value ?? '').match(/\b\d{4}\b/g) ?? []));

export const anzscoCodes = (value: string) =>
  Array.from(new Set((value ?? '').match(/\b\d{6}\b/g) ?? []));
