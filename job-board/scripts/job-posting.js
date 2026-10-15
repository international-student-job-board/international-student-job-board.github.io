// One role's schema.org JobPosting, written to Google's job posting guide:
// https://developers.google.com/search/docs/appearance/structured-data/job-posting
//
// seo-assets.js writes it into each role's static page; the app writes the same thing once it has
// mounted (src/jobPosting.ts is this file ported to TypeScript - the app's bundle can't reach
// outside src/). src/jobPosting.test.ts runs the two side by side on the same roles, so they
// can't drift apart: Google reads the page as rendered, which is the app's copy.
//
// The input is a plain description of the role, the same shape from either side:
//
//   { id, url, validThrough, title, company, website, tagline,
//     city, locationCity, locationState, posted,
//     employmentType, levels[], arrangements[], education[], occupations[],
//     salary: { source, min, max, currency, minAud, maxAud } }

const SITE = 'International Student Job Board';

const STATE_ABBREVIATIONS = {
  'New South Wales': 'NSW',
  Victoria: 'VIC',
  Queensland: 'QLD',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  Tasmania: 'TAS',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
};

/** Our employment types -> Google's (case-sensitive) employmentType values. */
const EMPLOYMENT = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Contract: 'CONTRACTOR',
  // Casual work in Australia is paid by the hour with no set hours - part-time, not a fixed term.
  Casual: 'PART_TIME',
  Freelance: 'CONTRACTOR',
  Internship: 'INTERN',
};

/**
 * Our education levels -> Google's credentialCategory values, lowest first. "Final year of degree"
 * is a student still studying, not a credential, so it maps to nothing.
 */
const CREDENTIALS = [
  ['Certification', 'professional certificate'],
  ['Diploma', 'associate degree'],
  ['Bachelor', 'bachelor degree'],
  ['Graduate Certification', 'postgraduate degree'],
  ['Graduate Diploma', 'postgraduate degree'],
  ['Master', 'postgraduate degree'],
  ['PhD', 'postgraduate degree'],
];

/** What sets a trailing piece off from the title proper. */
const SEPARATORS = [' | ', ' – ', ' — ', ' - ', ': '];

/** Where the last separator in the text starts, or -1. */
const lastSeparator = (text) =>
  Math.max(...SEPARATORS.map((separator) => text.lastIndexOf(separator)));

/** Words that stay capitalised when an all-caps title is brought down to title case. */
const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'for', 'to', 'in', 'at', 'with', 'on', 'a']);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const lower = (value) => String(value ?? '').trim().toLowerCase();

/** Every name the role's place goes by, lowercased - for spotting a place tacked onto a title. */
function placeWords(input) {
  const words = new Set(['australia', 'remote', 'hybrid', 'on-site', 'onsite', 'fully remote']);
  for (const value of [input.city, input.locationCity, input.locationState]) {
    if (lower(value)) words.add(lower(value));
  }
  for (const [state, abbreviation] of Object.entries(STATE_ABBREVIATIONS)) {
    words.add(state.toLowerCase());
    words.add(abbreviation.toLowerCase());
  }
  return words;
}

/** A piece of a title that is only a place, an arrangement, a postcode or a mix of those. */
function isPlaceOnly(piece, places) {
  const parts = piece
    .toLowerCase()
    .split(/\s*[,/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((part) => places.has(part) || /^\d{4}$/.test(part));
}

/** A job code ("NCS0008", "REQ-1234", "#12345"), a salary, or a date. */
const isNoise = (piece) =>
  /\$/.test(piece) ||
  /^(req|ref|job|jr|id)?\s*[#:-]?\s*[a-z]{0,4}-?\d{3,}$/i.test(piece.trim()) ||
  /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(piece.trim());

/**
 * The title Google asks for: "the title of the job only" - no job codes, addresses, dates,
 * salaries or company names, and no run of special characters. The advert's own title is kept as
 * written wherever it already is one; only what the guide names is taken off it.
 */
function schemaTitle(input) {
  const places = placeWords(input);
  let title = String(input.title ?? '')
    .replace(/[!*]/g, '')
    .replace(/^\s*(now\s+)?hiring\s*[:-]?\s*/i, '');

  // "(NCS0008)", "(Hybrid)", "(Melbourne, VIC)" - a bracket holding only a code or a place.
  title = title.replace(/\s*\(([^()]*)\)/g, (whole, inside) =>
    isNoise(inside) || isPlaceOnly(inside, places) ? '' : whole
  );

  // A trailing " | $220k OTE", " - Parafield", ": North Richmond, NSW, 2754", one at a time.
  for (;;) {
    const at = lastSeparator(title);
    if (at <= 0) break;
    const tail = title.slice(at).replace(/^\s*[|–—:-]\s*/, '').trim();
    if (!isNoise(tail) && !isPlaceOnly(tail, places)) break;
    title = title.slice(0, at);
  }
  // A date run onto the end with no separator: "Senior Product Designer 01.09.2026".
  title = title.replace(/\s+\d{1,2}[./]\d{1,2}[./]\d{2,4}$/, '');

  title = title
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .replace(/[\s|–—:,-]+$/, '')
    .trim();

  // All capitals reads as shouting in a search result: bring it down to title case, leaving the
  // short words that are acronyms ("ED RMO", "SIL") as they are.
  const letters = title.replace(/[^a-z]/gi, '');
  const longWords = title.split(/\s+/).filter((word) => word.replace(/[^a-z]/gi, '').length > 3);
  if (letters && letters === letters.toUpperCase() && longWords.length >= 2) {
    title = title
      .split(' ')
      .map((word, i) => {
        const bare = word.replace(/[^a-z]/gi, '');
        if (i > 0 && SMALL_WORDS.has(bare.toLowerCase())) return word.toLowerCase();
        if (bare.length <= 3) return word;
        return word.charAt(0) + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return title.length >= 3 ? title : String(input.title ?? '').replace(/[!*]/g, '').trim();
}

const fullyRemote = (input) =>
  input.arrangements.length === 1 && input.arrangements[0] === 'Remote';

/** "A$95,000 - A$110,000 a year" - the advert's own figure, in its own currency. */
function salaryText(salary) {
  const symbol = salary.currency === 'AUD' || !salary.currency ? 'A$' : `${salary.currency} `;
  const money = (n) => `${symbol}${Number(n).toLocaleString('en-AU')}`;
  const { min, max } = advertRange(salary);
  if (min && max && min !== max) return `${money(min)} - ${money(max)} a year`;
  return `${money(min || max)} a year`;
}

/** The advert's range, in the currency it was given in where that is known. */
function advertRange(salary) {
  const original = salary.min || salary.max;
  return original
    ? { min: salary.min || 0, max: salary.max || 0, currency: salary.currency || 'AUD' }
    : { min: salary.minAud || 0, max: salary.maxAud || 0, currency: 'AUD' };
}

const statedSalary = (salary) =>
  salary.source === 'advert' && Boolean(salary.min || salary.max || salary.minAud || salary.maxAud);

/**
 * "The full description of the job in HTML format", with paragraph breaks. The board doesn't
 * carry the advert's own text, so this is everything the board knows about the role - the same
 * facts the role's page shows - as <p> and <ul>/<li>, the tags Google reads for layout.
 */
function descriptionHtml(input, title) {
  const place = [input.city || input.locationCity, input.locationState].filter(Boolean).join(', ');
  const facts = [
    ['Employment type', input.employmentType],
    ['Job level', input.levels.join(', ')],
    ['Work arrangement', input.arrangements.join(', ')],
    ['Education', input.education.join(', ')],
    ['Salary', statedSalary(input.salary) ? `${salaryText(input.salary)}, as stated in the advert` : ''],
    ['Occupation (ANZSCO)', input.occupations.join(', ')],
    ['Location', place ? `${place}, Australia` : 'Australia'],
  ].filter(([, value]) => value);

  return [
    `<p>${escapeHtml(title)} at ${escapeHtml(input.company)}${place ? ` in ${escapeHtml(place)}` : ''}.</p>`,
    input.tagline ? `<p>About ${escapeHtml(input.company)}: ${escapeHtml(input.tagline)}</p>` : '',
    fullyRemote(input) ? '<p>This role is 100% remote, open to applicants in Australia.</p>' : '',
    `<ul>${facts.map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(v)}</li>`).join('')}</ul>`,
    `<p>Applications are made on ${escapeHtml(input.company)}'s own website, through the apply link on this page.</p>`,
  ].join('');
}

/** The lowest credential the advert asks for - a requirement is the minimum, not the best case. */
function educationRequirements(education) {
  const found = CREDENTIALS.find(([level]) => education.includes(level));
  return found ? { '@type': 'EducationalOccupationalCredential', credentialCategory: found[1] } : null;
}

function employmentTypes(input) {
  const types = new Set();
  if (EMPLOYMENT[input.employmentType]) types.add(EMPLOYMENT[input.employmentType]);
  if (input.levels.includes('Internship')) types.add('INTERN');
  const list = Array.from(types);
  return list.length > 1 ? list : list[0];
}

const website = (url) => (/^https?:\/\//i.test(String(url ?? '').trim()) ? url.trim() : '');

/** The whole JobPosting for one role. */
function jobPosting(input) {
  const title = schemaTitle(input);
  const employmentType = employmentTypes(input);
  const education = educationRequirements(input.education);
  const remote = fullyRemote(input);
  const range = advertRange(input.salary);
  const locality = input.city || input.locationCity;
  const region = STATE_ABBREVIATIONS[input.locationState] || input.locationState;

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    // Required.
    title,
    description: descriptionHtml(input, title),
    ...(input.posted ? { datePosted: input.posted } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: input.company,
      ...(website(input.website) ? { sameAs: website(input.website) } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(locality ? { addressLocality: locality } : {}),
        // The state of the place the advert names, not the employer's - and absent when the
        // place's name is in several states: a wrong value is worse than a missing one.
        ...(region ? { addressRegion: region } : {}),
        addressCountry: 'AU',
      },
    },
    // Recommended.
    ...(input.validThrough ? { validThrough: input.validThrough } : {}),
    ...(employmentType ? { employmentType } : {}),
    // Only a fully remote role: a hybrid one still has to be attended at its jobLocation, and
    // Google treats marking it remote as misleading.
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'Australia' },
        }
      : {}),
    // Only the salary the employer stated - "the actual base salary", never an estimate.
    ...(statedSalary(input.salary)
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: range.currency,
            value: {
              '@type': 'QuantitativeValue',
              ...(range.min && range.max && range.min !== range.max
                ? { minValue: range.min, maxValue: range.max }
                : { value: range.min || range.max }),
              unitText: 'YEAR',
            },
          },
        }
      : {}),
    ...(education ? { educationRequirements: education } : {}),
    identifier: { '@type': 'PropertyValue', name: SITE, value: input.id },
    // Applying happens on the employer's site, a click on from here - not on this page.
    directApply: false,
    url: input.url,
  };
}

module.exports = { jobPosting, schemaTitle, STATE_ABBREVIATIONS };
