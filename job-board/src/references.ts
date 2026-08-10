// Links out to official government / assessing-authority references for the
// visa, skills-assessment and ANZSCO fields. Every job that names one of these
// should link to its source - see the "always link gov resources" convention.

import occupations from './data/occupations.json';
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

// The canonical occupation reference (src/data/occupations.json), keyed by the
// 6-digit ANZSCO code. Holds the occupation name and the two links so the file
// is the single source of truth; the code just looks entries up.
// One visa an occupation can be used for, e.g. { code: '189', name: 'Skilled
// Independent', stream: 'Points-Tested' }.
export interface OccupationVisa {
  code: string;
  name: string;
  stream?: string;
}

interface OccupationRecord {
  name: string;
  anzscoUrl: string;
  assessment: string;
  assessmentUrl?: string;
  // Skilled-migration lists the occupation sits on, e.g. ["MLTSSL", "CSOL"].
  lists?: string[];
  // Visas the occupation can be used for (from the skilled occupation list).
  visas?: OccupationVisa[];
}

const OCCUPATIONS = occupations as unknown as Record<string, OccupationRecord>;

// Occupations currently in the reference file, for the local admin picker.
export function listOccupations(): { code: string; name: string }[] {
  return Object.entries(OCCUPATIONS)
    .map(([code, o]) => ({ code, name: o.name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// Everything the UI needs to render a job's occupation, resolved from the
// reference file with sensible fallbacks so a job whose code isn't in the file
// yet still links correctly. `job.anzsco` may be a bare code ("261313") or code
// plus name ("261313 Software Engineer"); `job.skillAssessment` is an optional
// per-job override of the authority.
export interface ResolvedOccupation {
  code: string;
  name: string;
  anzscoHref?: string;
  assessment: string;
  assessmentHref?: string;
  lists: string[];
  visas: OccupationVisa[];
}

export function resolveOccupation(
  anzsco: string,
  skillAssessment: string
): ResolvedOccupation {
  const code = anzsco.match(/\b(\d{6})\b/)?.[1] ?? '';
  const record = code ? OCCUPATIONS[code] : undefined;

  // Occupation name: the reference file wins; otherwise the free text minus the
  // code (so "261313 Software Engineer" still shows "Software Engineer").
  const name =
    record?.name || anzsco.replace(/\b\d{6}\b/, '').trim() || anzsco.trim();

  // A per-job skill assessment always overrides the reference authority.
  const assessment = skillAssessment.trim() || record?.assessment || '';

  return {
    code,
    name,
    anzscoHref: record?.anzscoUrl || anzscoUrl(anzsco),
    assessment,
    assessmentHref:
      (skillAssessment.trim() ? assessmentUrl(skillAssessment) : record?.assessmentUrl) ||
      assessmentUrl(assessment),
    lists: record?.lists ?? [],
    visas: record?.visas ?? [],
  };
}

/**
 * Every occupation a role maps to. A job can sit across more than one ANZSCO
 * code — a "Data Engineer" is plausibly 261313 and 261311 — and which one an
 * applicant is assessed under changes their visa options, so the board keeps
 * all of them rather than forcing a single choice.
 */
export function resolveOccupations(job: Job): ResolvedOccupation[] {
  return job.anzscos
    .map((entry) => resolveOccupation(entry, job.skillAssessment))
    .filter((occ) => occ.code || occ.name);
}

/** The 6-digit codes a role maps to, skipping any entry we couldn't read. */
export function occupationCodesFor(job: Job): string[] {
  return Array.from(
    new Set(resolveOccupations(job).map((occ) => occ.code).filter(Boolean))
  );
}

/** The assessing authorities across all of a role's occupations. */
export function assessmentsFor(job: Job): string[] {
  return Array.from(
    new Set(resolveOccupations(job).map((occ) => occ.assessment).filter(Boolean))
  );
}

/**
 * Every visa a role can lead to: the pathways named on the job itself, plus
 * every visa any of its ANZSCO occupations can be used for. Deduplicated by
 * subclass, since an occupation can list the same code more than once for
 * different streams, and two occupations routinely share visas.
 *
 * This has to be the single answer to "what does this role lead to". The union
 * used to be computed inside the detail page only, so the filter offered just
 * the subclasses typed onto the job — a role whose occupation opened up a 482
 * showed it on the page but could not be found by filtering for it.
 */
export function pathwayVisasFor(job: Job): string[] {
  const fromOccupations = resolveOccupations(job).flatMap((occ) =>
    occ.visas.map((v) => v.code)
  );
  return Array.from(new Set([...job.visaPathways, ...fromOccupations]));
}

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
