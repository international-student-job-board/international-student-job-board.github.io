// Links out to official government / assessing-authority references for the
// visa, skills-assessment and ANZSCO fields. Every job that names one of these
// should link to its source - see the "always link gov resources" convention.

import { Job } from './types';

export const VISA_LISTING =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing';

// Home Affairs visa-listing page per subclass. Slugs are verified against the
// live site (some are irregular, e.g. 482's long slug). Codes not listed here
// simply render as plain text.
const VISA_LINKS: Record<string, string> = {
  '186': `${VISA_LISTING}/employer-nomination-scheme-186`,
  '187': `${VISA_LISTING}/regional-sponsor-migration-scheme-187`,
  '189': `${VISA_LISTING}/skilled-independent-189`,
  '190': `${VISA_LISTING}/skilled-nominated-190`,
  '191': `${VISA_LISTING}/skilled-regional-191`,
  '400': `${VISA_LISTING}/temporary-work-short-stay-specialist-400`,
  // Was `training-visa-407`, which 404s — the slug drops the word "visa".
  '407': `${VISA_LISTING}/training-407`,
  '408': `${VISA_LISTING}/temporary-activity-408`,
  '417': `${VISA_LISTING}/work-holiday-417`,
  '462': `${VISA_LISTING}/work-and-holiday-462`,
  '476': `${VISA_LISTING}/skilled-recognised-graduate-476`,
  '482': `${VISA_LISTING}/skills-in-demand-visa-subclass-482`,
  '485': `${VISA_LISTING}/temporary-graduate-485`,
  '489': `${VISA_LISTING}/skilled-regional-provisional-489`,
  '491': `${VISA_LISTING}/skilled-work-regional-provisional-491`,
  '494': `${VISA_LISTING}/skilled-employer-sponsored-regional-494`,
  '500': `${VISA_LISTING}/student-500`,
  '590': `${VISA_LISTING}/student-guardian-590`,
};

// Official Home Affairs page for a visa subclass, or undefined if unknown.
export function visaUrl(code: string): string | undefined {
  return VISA_LINKS[code.trim()];
}

// Friendly names per subclass, used to build the selectable visa tags in the
// local admin. Keep in step with VISA_LINKS.
export const VISA_NAMES: Record<string, string> = {
  '186': 'Employer Nomination Scheme',
  '187': 'Regional Sponsored Migration Scheme',
  '189': 'Skilled Independent',
  '190': 'Skilled Nominated',
  '191': 'Skilled Regional (Permanent)',
  '400': 'Temporary Work (Short Stay Specialist)',
  '407': 'Training',
  '408': 'Temporary Activity',
  '417': 'Working Holiday',
  '462': 'Work and Holiday',
  '476': 'Skilled Recognised Graduate',
  '482': 'Skills in Demand',
  '485': 'Temporary Graduate',
  '489': 'Skilled Regional (Provisional)',
  '491': 'Skilled Work Regional (Provisional)',
  '494': 'Skilled Employer Sponsored Regional (Provisional)',
  '500': 'Student',
  '590': 'Student Guardian',
};

// Selectable visa tags for the admin, sorted by subclass code.
export const VISA_OPTIONS: { code: string; name: string }[] = Object.entries(VISA_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code));

// A friendly name for a subclass ("189" -> "Skilled Independent"), falling back
// to "Subclass NNN" for codes we don't have a name for.
export function visaName(code: string): string {
  return VISA_NAMES[code.trim()] || `Subclass ${code.trim()}`;
}

// Known skills-assessing authorities → their migration-assessment page. Matched
// on a substring of the (lowercased) authority name so "Engineers Australia
// (MSA)" still resolves. Order matters: first match wins.
const ASSESSMENT_LINKS: Array<[string, string]> = [
  ['acs', 'https://www.acs.org.au/msa.html'],
  ['engineers australia', 'https://www.engineersaustralia.org.au/migration-skills-assessment'],
  ['vetassess', 'https://www.vetassess.com.au/skills-assessment-for-migration'],
  ['cpa', 'https://www.cpaaustralia.com.au/become-a-cpa/migration-assessment'],
  ['chartered accountants', 'https://www.charteredaccountantsanz.com/migration-assessment'],
  ['ipa', 'https://www.publicaccountants.org.au/migration-assessment'],
  ['ahpra', 'https://www.ahpra.gov.au'],
  ['aaca', 'https://www.aaca.org.au'],
  ['aims', 'https://www.aims.org.au'],
  ['acecqa', 'https://www.acecqa.gov.au'],
  ['anmac', 'https://www.anmac.org.au'],
  ['aphra', 'https://www.ahpra.gov.au'],
  ['aqfas', 'https://internationaleducation.gov.au'],
  ['trades recognition', 'https://www.tradesrecognitionaustralia.gov.au'],
  ['tra', 'https://www.tradesrecognitionaustralia.gov.au'],
];

// Official page for a named assessing authority, or undefined if unknown.
export function assessmentUrl(authority: string): string | undefined {
  const name = authority.trim().toLowerCase();
  if (!name) return undefined;
  const hit = ASSESSMENT_LINKS.find(([key]) => name.includes(key));
  return hit?.[1];
}

// Official ABS ANZSCO 2022 classification browser. The browser is hierarchical
// and bottoms out at the 4-digit unit group (there is no 6-digit page), so we
// build the path from the code's nested prefixes:
//   261313 -> /2/26/261/2613  (major / sub-major / minor / unit group)
// The unit-group page lists and describes the specific 6-digit occupation.
// Pulls the leading 6-digit code out of free text like "261313 Software
// Engineer"; undefined if there's no code to link.
const ANZSCO_BROWSE =
  'https://www.abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2022/browse-classification';

export function anzscoUrl(code: string): string | undefined {
  const match = code.match(/\b(\d{6})\b/)?.[1];
  if (!match) return undefined;
  const [major, submajor, minor, unit] = [1, 2, 3, 4].map((n) => match.slice(0, n));
  return `${ANZSCO_BROWSE}/${major}/${submajor}/${minor}/${unit}`;
}

/**
 * The occupation reference: content/occupation-index.json, keyed by ANZSCO code.
 *
 * It is generated from the Home Affairs skilled occupation list by
 * `npm run fetch-occupations`, which is the only place any of this is decided.
 * Nothing here is typed in by hand any more — a job carries codes, and the
 * lists, visas and assessing authority all follow from them. That removes a
 * whole class of disagreement: a role could previously name one assessor while
 * its occupation named another, and the page had to pick.
 *
 * Both classification versions key the same entry, so a job resolves whether it
 * carries the 2022 code, the 2013 code or both.
 *
 * Fetched once before first render, which keeps every caller below synchronous —
 * they are used inside filtering and inside render alike.
 */
export interface OccupationAssessor {
  name: string;
  url: string;
}

interface IndexEntry {
  name: string;
  /** Both classification versions, so the admin can fill both CSV columns. */
  codes: { anzsco2022?: string; anzsco2013?: string };
  /**
   * The ABS page for each version, taken from the Home Affairs listing rather
   * than constructed. Only the 2022 URL is constructible — the 2013 ones end in
   * an opaque document id — so both are carried through from the source.
   */
  urls?: { anzsco2022?: string; anzsco2013?: string };
  /** Skilled-migration lists the occupation sits on, e.g. ["MLTSSL", "CSOL"]. */
  lists: string[];
  /** Subclass numbers the occupation can be used for. */
  visas: string[];
  assessors: OccupationAssessor[];
}

let OCCUPATIONS: Record<string, IndexEntry> = {};
let RETRIEVED = '';

export async function loadOccupations(): Promise<void> {
  const res = await fetch(`${process.env.PUBLIC_URL || ''}/data/occupation-index.json`);
  if (!res.ok) throw new Error(`Could not load the occupation index (${res.status})`);
  const payload = (await res.json()) as { retrieved?: string; occupations?: Record<string, IndexEntry> };
  OCCUPATIONS = payload.occupations ?? {};
  RETRIEVED = payload.retrieved ?? '';
}

/** Replaces the whole reference. Used by tests to stand in a fixture. */
export function setOccupations(records: Record<string, IndexEntry>): void {
  OCCUPATIONS = records;
}

/** When the occupation list was last downloaded, for the on-page disclaimer. */
export function occupationIndexDate(): string {
  return RETRIEVED;
}

/** One occupation as the admin picks it: a name and the codes it writes. */
export interface OccupationChoice {
  name: string;
  anzsco2022: string;
  anzsco2013: string;
}

/**
 * Every occupation in the reference, deduplicated.
 *
 * The index is keyed by code and the same occupation appears under both of its
 * codes, so walking the keys would list most occupations twice.
 */
export function listOccupations(): OccupationChoice[] {
  const byName = new Map<string, OccupationChoice>();
  Object.values(OCCUPATIONS).forEach((o) => {
    if (!byName.has(o.name)) {
      byName.set(o.name, {
        name: o.name,
        anzsco2022: o.codes?.anzsco2022 ?? '',
        anzsco2013: o.codes?.anzsco2013 ?? '',
      });
    }
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** The occupation name for a code, or '' when the reference doesn't have it. */
export function occupationName(code: string): string {
  return OCCUPATIONS[code.trim()]?.name ?? '';
}

/** One ANZSCO code as shown: which classification it belongs to, and its link. */
export interface OccupationCode {
  version: '2022' | '2013';
  code: string;
  href?: string;
}

export interface ResolvedOccupation {
  name: string;
  codes: OccupationCode[];
  lists: string[];
  visas: string[];
  assessors: OccupationAssessor[];
}

/**
 * The occupations a role maps to, resolved from its codes.
 *
 * A role usually carries the same occupation twice — once as its 2022 code and
 * once as its 2013 one — so entries are grouped by the occupation they resolve
 * to and carry both codes, rather than being listed twice under one name. Where
 * the two versions genuinely disagree (they do for a handful of occupations)
 * they stay separate, because they are separate occupations.
 *
 * Codes the reference doesn't know still appear, with the name from the CSV if
 * it gave one: an occupation missing from the list is worth showing as a code,
 * and dropping it silently would make the page look like it had nothing to say.
 */
export function resolveOccupations(job: Job): ResolvedOccupation[] {
  // Each version links to its own ABS page: the 2022 codes to the current
  // classification browser, the 2013 ones to the archived ausstats lookup.
  // Both come from the reference; the constructed 2022 URL is a fallback for a
  // code the reference has no entry for, and a 2013 code without one simply has
  // no link, since pointing it at a 2022 page would be confidently wrong.
  const pairs: OccupationCode[] = [
    ...job.anzsco2022.map((code) => ({
      version: '2022' as const,
      code,
      href: OCCUPATIONS[code]?.urls?.anzsco2022 || anzscoUrl(code),
    })),
    ...job.anzsco2013.map((code) => ({
      version: '2013' as const,
      code,
      href: OCCUPATIONS[code]?.urls?.anzsco2013,
    })),
  ];

  const byOccupation = new Map<string, ResolvedOccupation>();
  pairs.forEach((pair, i) => {
    const entry = OCCUPATIONS[pair.code];
    // Unknown codes group under themselves rather than under a shared blank
    // name, which would merge two unrelated occupations into one row.
    const key = entry ? entry.name : `#${pair.code}`;
    const seen = byOccupation.get(key);
    if (seen) {
      if (!seen.codes.some((c) => c.code === pair.code && c.version === pair.version)) {
        seen.codes.push(pair);
      }
      return;
    }
    byOccupation.set(key, {
      name: entry?.name || job.occupationNames[i] || job.occupationNames[0] || '',
      codes: [pair],
      lists: entry?.lists ?? [],
      visas: entry?.visas ?? [],
      assessors: entry?.assessors ?? [],
    });
  });

  return Array.from(byOccupation.values());
}

/** Every ANZSCO code a role carries, both versions. */
export function occupationCodesFor(job: Job): string[] {
  return Array.from(new Set([...job.anzsco2022, ...job.anzsco2013]));
}

/** The assessing authorities across all of a role's occupations, by name. */
export function assessmentsFor(job: Job): string[] {
  return Array.from(
    new Set(resolveOccupations(job).flatMap((occ) => occ.assessors.map((a) => a.name)))
  );
}

/** The assessing authorities, with their links, deduplicated by name. */
export function assessorsFor(job: Job): OccupationAssessor[] {
  const byName = new Map<string, OccupationAssessor>();
  resolveOccupations(job).forEach((occ) =>
    occ.assessors.forEach((a) => !byName.has(a.name) && byName.set(a.name, a))
  );
  return Array.from(byName.values());
}

/** The skilled-migration lists a role's occupations sit on. */
export function occupationListsFor(job: Job): string[] {
  return Array.from(new Set(resolveOccupations(job).flatMap((occ) => occ.lists)));
}

/**
 * Every visa a role can lead to: the union across its occupations, since which
 * occupation an applicant is assessed under decides what they can apply for.
 *
 * This is the single answer to "what does this role lead to" — the filter and
 * the detail page both read it, so a role can always be found by the visas it
 * is shown to offer.
 */
export function pathwayVisasFor(job: Job): string[] {
  return Array.from(new Set(resolveOccupations(job).flatMap((occ) => occ.visas))).sort();
}

// Home Affairs' side-by-side of the employer-sponsored skilled visas, for
// employers working out which one they could offer. Lives here with the other
// government references rather than in a component, so there is one place to
// correct a Home Affairs URL when they move it.
export const EMPLOYER_VISA_COMPARISON_URL =
  'https://immi.homeaffairs.gov.au/employer-subsite/Pages/compare-sponsored-skilled-visa-options.aspx';

// Where the occupation-list data comes from; surfaced in the on-page disclaimer.
export const SKILL_OCCUPATION_LIST_URL =
  'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list';

// The skilled-migration lists an occupation can sit on. Names and links kept
// together so they can't drift apart, the same way VISA_NAMES tracks
// VISA_LINKS.
export const OCCUPATION_LIST_NAMES: Record<string, string> = {
  MLTSSL: 'Medium and Long-term Strategic Skills List',
  CSOL: 'Core Skills Occupation List',
  STSOL: 'Short-term Skilled Occupation List',
  ROL: 'Regional Occupation List',
};

// All four point at the Home Affairs skilled-occupation-list index, which is
// the page that carries every list and is known to resolve. Per-list deep
// links can replace an entry here individually once the slug is confirmed
// against the live site — guessing one is what left the 407 link pointing at a
// 404. An unknown list renders as plain text rather than a broken link.
const OCCUPATION_LIST_LINKS: Record<string, string> = {
  MLTSSL: SKILL_OCCUPATION_LIST_URL,
  CSOL: SKILL_OCCUPATION_LIST_URL,
  STSOL: SKILL_OCCUPATION_LIST_URL,
  ROL: SKILL_OCCUPATION_LIST_URL,
};

/** Official page for a skilled-occupation list, or undefined if unknown. */
export function occupationListUrl(list: string): string | undefined {
  return OCCUPATION_LIST_LINKS[list.trim().toUpperCase()];
}

/** "MLTSSL" -> "MLTSSL - Medium and Long-term Strategic Skills List". */
export function occupationListLabel(list: string): string {
  const key = list.trim().toUpperCase();
  const name = OCCUPATION_LIST_NAMES[key];
  return name ? `${key} - ${name}` : key;
}

export const VISA_DISCLAIMER =
  'This is a general guide, not legal or immigration advice.\n\nThe visa, pathway and ' +
  'occupation details are compiled from the Department of Home Affairs skill occupation ' +
  'list and can change at any time.\n\nAlways get professional advice from a registered ' +
  'migration agent or immigration lawyer about your own situation.';
