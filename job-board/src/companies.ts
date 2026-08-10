// The Melbourne companies reference (public/melbourne_companies_hiring.csv).
// Like the ANZSCO list it lives in public/ and is fetched on demand: 400-odd
// rows are only needed by the "startups hiring" page and the posting form, not
// by every visitor to the job board.

const CSV_URL = `${process.env.PUBLIC_URL || ''}/melbourne_companies_hiring.csv`;

export interface Company {
  name: string;
  /** "startup" or "scaleup". */
  segment: string;
  /** What the company builds — big data, saas, machine learning… */
  types: string[];
  /** The markets it sells into — fintech, health, marketing… */
  industries: string[];
  website: string;
  linkedin: string;
  /** Free-text HQ address; the postcode in it is what places the map pin. */
  address: string;
  /** The company's own one-liner, reused as the blurb on its job listings. */
  tagline: string;
  growthStage: string;
  employees: string;
  /** Roles the company had open when the list was compiled. */
  openings: number;
  status: string;
  /** Both come from the last two CSV columns, filled in as each company is
      checked by hand. Blank means "not reviewed yet", not "no". */
  sponsorsVisas: boolean;
  hiresInternationalStudents: boolean;
}

/** Reads the yes/no columns tolerantly — they're filled in by hand. */
const isYes = (value: string) =>
  ['yes', 'y', 'true', '1'].includes((value ?? '').trim().toLowerCase());

/**
 * A small RFC-4180 reader, rather than a CSV library: this is the only CSV the
 * site reads, and a parser dependency cost more in bundle size than the whole
 * companies feature. It handles the two things that actually appear in this
 * file — commas inside quoted fields (addresses, taglines) and doubled quotes
 * as an escape.
 */
function parseCsv(text: string): Record<string, string>[] {
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

const splitList = (value: string) =>
  (value ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean);

function toCompany(row: Record<string, string>): Company {
  return {
    name: (row['Company name'] ?? '').trim(),
    segment: (row['Segment'] ?? '').trim(),
    types: splitList(row['Type']),
    industries: splitList(row['Industries']),
    website: (row['Website'] ?? '').trim(),
    linkedin: (row['LinkedIn'] ?? '').trim(),
    address: (row['HQ address'] ?? '').trim(),
    tagline: (row['Tagline'] ?? '').trim(),
    growthStage: (row['Growth stage'] ?? '').trim(),
    employees: (row['Employees'] ?? '').trim(),
    openings: Number.parseInt(row['Job openings'] ?? '', 10) || 0,
    status: (row['Status'] ?? '').trim(),
    sponsorsVisas: isYes(row['Sponsor visa available']),
    hiresInternationalStudents: isYes(row['Hires international students']),
  };
}

let pending: Promise<Company[]> | null = null;

export function loadCompanies(): Promise<Company[]> {
  if (!pending) {
    pending = fetch(CSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the company list (${res.status})`);
        return res.text();
      })
      .then((text) =>
        parseCsv(text)
          .map(toCompany)
          .filter((c) => c.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export type CompanySort = 'openings' | 'name';

/** Sorted for display: most roles first, or alphabetically. */
export function sortCompanies(companies: Company[], sort: CompanySort): Company[] {
  const sorted = [...companies];
  if (sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  // Ties fall back to the name, so equal counts don't shuffle between renders.
  return sorted.sort(
    (a, b) => b.openings - a.openings || a.name.localeCompare(b.name)
  );
}

/** Companies matching a query on name, industry or what they build. */
export function searchCompanies(companies: Company[], query: string): Company[] {
  const q = query.trim().toLowerCase();
  if (!q) return companies;

  const rank = (c: Company): number => {
    const name = c.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if (c.industries.some((i) => i.toLowerCase().includes(q))) return 3;
    if (c.types.some((t) => t.toLowerCase().includes(q))) return 4;
    if (c.tagline.toLowerCase().includes(q)) return 5;
    return -1;
  };

  return companies
    .map((company) => ({ company, score: rank(company) }))
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || a.company.name.localeCompare(b.company.name))
    .map((hit) => hit.company);
}

/** Case-insensitive lookup, for filling in a company a poster has named. */
export function findCompany(companies: Company[], name: string): Company | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return companies.find((c) => c.name.toLowerCase() === key);
}
