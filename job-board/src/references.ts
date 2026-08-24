// Links out to official government / assessing-authority references for the visa, skills-
// assessment and ANZSCO fields.

import { Job } from './types';

export const VISA_LISTING =
  'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing';

// Home Affairs visa-listing page per subclass.
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

// Friendly names per subclass, used to build the selectable visa tags in the local admin.
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

// A friendly name for a subclass ("189" -> "Skilled Independent"), falling back to
// "Subclass NNN" for codes we don't have a name for.
export function visaName(code: string): string {
  return VISA_NAMES[code.trim()] || `Subclass ${code.trim()}`;
}

// Known skills-assessing authorities → their migration-assessment page.
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

// Official ABS ANZSCO 2022 classification browser.
const ANZSCO_BROWSE =
  'https://www.abs.gov.au/statistics/classifications/anzsco-australian-and-new-zealand-standard-classification-occupations/2022/browse-classification';

export function anzscoUrl(code: string): string | undefined {
  const match = code.match(/\b(\d{6})\b/)?.[1];
  if (!match) return undefined;
  const [major, submajor, minor, unit] = [1, 2, 3, 4].map((n) => match.slice(0, n));
  return `${ANZSCO_BROWSE}/${major}/${submajor}/${minor}/${unit}`;
}

/** The occupation reference: content/occupation-index.json, keyed by ANZSCO code. */
export interface OccupationAssessor {
  name: string;
  url: string;
}

interface IndexEntry {
  name: string;
  /** Both classification versions, so the admin can fill both CSV columns. */
  codes: { anzsco2022?: string; anzsco2013?: string };
  /**
   * The ABS page for each version, taken from the Home Affairs listing rather than
   * constructed.
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

/** Every occupation in the reference, deduplicated. */
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

/** The occupations a role maps to, resolved from its codes. */
export function resolveOccupations(job: Job): ResolvedOccupation[] {
  // Each version links to its own ABS page: the 2022 codes to the current classification
  // browser, the 2013 ones to the archived ausstats lookup.
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
    // Unknown codes group under themselves rather than under a shared blank name, which
    // would merge two unrelated occupations into one row.
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
 * Every visa a role can lead to: the union across its occupations, since which occupation
 * an applicant is assessed under decides what they can apply for.
 */
export function pathwayVisasFor(job: Job): string[] {
  return Array.from(new Set(resolveOccupations(job).flatMap((occ) => occ.visas))).sort();
}

// Home Affairs' side-by-side of the employer-sponsored skilled visas, for employers working
// out which one they could offer.
export const EMPLOYER_VISA_COMPARISON_URL =
  'https://immi.homeaffairs.gov.au/employer-subsite/Pages/compare-sponsored-skilled-visa-options.aspx';

// Where the occupation-list data comes from; surfaced in the on-page disclaimer.
export const SKILL_OCCUPATION_LIST_URL =
  'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list';

// The skilled-migration lists an occupation can sit on.
export const OCCUPATION_LIST_NAMES: Record<string, string> = {
  MLTSSL: 'Medium and Long-term Strategic Skills List',
  CSOL: 'Core Skills Occupation List',
  STSOL: 'Short-term Skilled Occupation List',
  ROL: 'Regional Occupation List',
};

// All four point at the Home Affairs skilled-occupation-list index, which is the page that
// carries every list and is known to resolve.
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

// ---- OSCA -----------------------------------------------------------------

const OSCA_BROWSE =
  'https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/browse-classification';

interface OscaEntry {
  name: string;
  unitGroup?: string;
}

let OSCA: Record<string, OscaEntry> = {};

export async function loadOscaOccupations(): Promise<void> {
  const res = await fetch(`${process.env.PUBLIC_URL || ''}/data/osca-index.json`);
  if (!res.ok) throw new Error(`Could not load the OSCA index (${res.status})`);
  const payload = (await res.json()) as { occupations?: Record<string, OscaEntry> };
  OSCA = payload.occupations ?? {};
}

/** Replaces the whole reference. Used by tests to stand in a fixture. */
export function setOscaOccupations(records: Record<string, OscaEntry>): void {
  OSCA = records;
}

/**
 * The ABS page for an OSCA code.
 *
 * A six-digit code contains its own path — 111131 sits under 1 / 11 / 111 /
 * 1111 — so the URL is built rather than stored, which keeps 1,156 long strings
 * out of the file the browser downloads.
 */
export function oscaUrl(code: string): string | undefined {
  const match = code.trim().match(/^(\d{6})$/)?.[1];
  if (!match) return undefined;
  const path = [1, 2, 3, 4].map((n) => match.slice(0, n)).join('/');
  return `${OSCA_BROWSE}/${path}/${match}`;
}

export interface ResolvedOsca {
  code: string;
  name: string;
  href?: string;
}

/** The OSCA occupations a role maps to, named from the reference. */
export function resolveOsca(job: Job): ResolvedOsca[] {
  return job.oscaCodes.map((code, i) => ({
    code,
    name: OSCA[code]?.name || job.oscaNames[i] || job.oscaNames[0] || '',
    href: oscaUrl(code),
  }));
}

/** Every OSCA code a role carries, for filtering. */
export function oscaCodesFor(job: Job): string[] {
  return Array.from(new Set(job.oscaCodes));
}

/** The name for an OSCA code, or '' when the reference doesn't have it. */
export function oscaName(code: string): string {
  return OSCA[code.trim()]?.name ?? '';
}

// ---- ANZSCO unit groups ---------------------------------------------------

/**
 * Unit-group titles, keyed by code.
 *
 * Neither reference file has these — the four-digit titles come only from the
 * jobs CSV, so the loader registers what it saw and the filter reads it back.
 */
let UNIT_GROUP_TITLES: Record<string, string> = {};

export function setUnitGroupTitles(titles: Record<string, string>): void {
  UNIT_GROUP_TITLES = titles;
}

/** "2613" -> "Software and Applications Programmers", or '' if unknown. */
export function unitGroupTitle(code: string): string {
  return UNIT_GROUP_TITLES[code.trim()] ?? '';
}

/**
 * The unit groups a role sits in: the four-digit level above the occupation.
 *
 * A role can sit in more than one — a marketing job maps to both the manager
 * group and the professional group — so codes and titles are paired by
 * position, the way the file writes them. Where the column is blank the group
 * is derived from a six-digit code instead, since its first four digits are its
 * unit group.
 */
export function unitGroupsFor(job: Job): { code: string; title: string }[] {
  const codes = job.anzscoUnitGroups.length
    ? job.anzscoUnitGroups
    : Array.from(
        new Set(
          [...job.anzsco2022, ...job.anzsco2013]
            .map((code) => code.slice(0, 4))
            .filter((code) => /^\d{4}$/.test(code))
        )
      );

  return codes.map((code, i) => ({
    code,
    title: job.anzscoUnitGroupTitles[i] || unitGroupTitle(code),
  }));
}

/** Every unit-group code a role sits in, for filtering. */
export function unitGroupCodesFor(job: Job): string[] {
  return unitGroupsFor(job).map((group) => group.code);
}

/** The ABS page for a four-digit ANZSCO unit group. */
export function unitGroupUrl(code: string): string | undefined {
  const match = code.trim().match(/^(\d{4})$/)?.[1];
  if (!match) return undefined;
  const path = [1, 2, 3, 4].map((n) => match.slice(0, n)).join('/');
  return `${ANZSCO_BROWSE}/${path}`;
}

// ---- SkillSelect invitation rounds -----------------------------------------

// Home Affairs' own page for the round that "Invited Score" is read off, in the data
// pipeline that produces jobs.csv.
export const SKILLSELECT_INVITATION_ROUNDS_URL =
  'https://immi.homeaffairs.gov.au/visas/working-in-australia/skillselect/invitation-rounds';

/**
 * Minimum score by ANZSCO code, for whichever occupations the latest SkillSelect round
 * invited. Neither reference file has this either — like the unit-group titles, it comes
 * only from the jobs CSV's own "Invited Score" column, so the loader registers what it saw
 * and the filter reads it back.
 */
let INVITED_SCORES: Record<string, number> = {};

export function setInvitedScores(scores: Record<string, number>): void {
  INVITED_SCORES = scores;
}

/** The minimum score SkillSelect invited that occupation at, or undefined if it wasn't. */
export function invitedScoreFor(code: string): number | undefined {
  return INVITED_SCORES[code.trim()];
}

/**
 * A role's occupation codes, but only when the role was in the latest SkillSelect
 * invitation round — the empty list otherwise, so it drops out of a filter built from this
 * rather than showing up unselectable.
 */
export function invitedOccupationCodesFor(job: Job): string[] {
  return job.invitedScore === undefined ? [] : occupationCodesFor(job);
}

/** What OSCA is, wherever one of its codes is shown. */
export const OSCA_NOTE =
  'OSCA - Occupation Standard Classification for Australia.\n\n' +
  'OSCA replaced ANZSCO as the ABS classification in December 2024, but it is ' +
  'not yet used in visa processing. Visa eligibility still depends on the ' +
  'ANZSCO occupation, so treat OSCA as context rather than as what a visa is ' +
  'assessed against.';

/** What the invited-round filter and tag mean, wherever a score is shown. */
export const INVITED_ROUND_NOTE =
  "The latest occupations and the minimum points score to receive an invitation to apply for the Skilled Independent visa (subclass 189), by the Department of Home Affairs.\n\n";

/** How the two hand-checked columns are filled in, on both pages. */
export const MANUAL_REVIEW_NOTE =
  "We're working through this list by hand to confirm which companies sponsor " +
  'visas and which hire international students and graduates.\n\n' +
  "A company without those tags hasn't been checked yet!";

/** What a unit group is, for the roles that can only be placed that far. */
export const UNIT_GROUP_NOTE =
  'The four-digit ANZSCO group an occupation belongs to. Roles we cannot match ' +
  'to a single six-digit occupation are placed at this level instead.';

/** What ANZSCO stands for, wherever a code or occupation is shown. */
export const ANZSCO_NOTE =
  'ANZSCO - Australian and New Zealand Standard Classification of Occupations.';

/** The skilled-migration lists, spelled out for the filter. */
export const OCCUPATION_LIST_NOTE = [
  'The skilled-migration lists an occupation sits on.',
  '',
  ...Object.entries(OCCUPATION_LIST_NAMES).map(([code, name]) => `${code} - ${name}`),
].join('\n');

export const VISA_DISCLAIMER =
  'This is a general guide, not legal or immigration advice.\n\nThe visa, pathway and ' +
  'occupation details are compiled from the Department of Home Affairs skill occupation ' +
  'list and can change at any time.\n\nAlways get professional advice from a registered ' +
  'migration agent or immigration lawyer about your own situation.';
