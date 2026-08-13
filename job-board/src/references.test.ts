import {
  setOccupations,
  resolveOccupations,
  occupationCodesFor,
  pathwayVisasFor,
  assessmentsFor,
  assessorsFor,
  occupationListsFor,
  occupationName,
  listOccupations,
  visaUrl,
  occupationListLabel,
} from './references';
import { Job } from './types';

/** The reference as the generated index holds it: keyed by every code. */
const SOFTWARE = {
  name: 'Software Engineer',
  codes: { anzsco2022: '261313', anzsco2013: '261313' },
  urls: {
    anzsco2022: 'https://www.abs.gov.au/statistics/classifications/2022/browse/2/26/261/2613',
    anzsco2013: 'http://www.abs.gov.au/ausstats/abs%40.nsf/Product+Lookup/SOFTWARE?opendocument',
  },
  lists: ['MLTSSL', 'CSOL'],
  visas: ['189', '482', '186'],
  assessors: [{ name: 'ACS', url: 'https://www.acs.org.au/' }],
};

const ANALYST = {
  name: 'Data Analyst',
  codes: { anzsco2022: '224114', anzsco2013: '224999' },
  urls: { anzsco2022: 'https://www.abs.gov.au/statistics/classifications/2022/browse/2/22/224/2241' },
  lists: ['CSOL'],
  visas: ['482'],
  assessors: [{ name: 'VETASSESS', url: 'https://www.vetassess.com.au/' }],
};

beforeEach(() => {
  setOccupations({
    '261313': SOFTWARE,
    '224114': ANALYST,
    '224999': ANALYST,
  });
});

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: '1',
    title: 'Engineer',
    type: '',
    occupationNames: [],
    anzsco2022: [],
    anzsco2013: [],
    city: '',
    country: '',
    posted: '',
    applyUrl: '',
    company: {} as Job['company'],
    ...over,
  }) as Job;

describe('resolving a role’s occupations', () => {
  test('the same occupation under both codes is one entry carrying both', () => {
    const [occ, ...rest] = resolveOccupations(
      job({ anzsco2022: ['261313'], anzsco2013: ['261313'] })
    );
    expect(rest).toHaveLength(0);
    expect(occ.name).toBe('Software Engineer');
    expect(occ.codes.map((c) => `${c.version}:${c.code}`)).toEqual(['2022:261313', '2013:261313']);
  });

  test('codes that differ between versions still resolve to one occupation', () => {
    // Data Analyst is 224114 in ANZSCO 2022 and 224999 in 2013 — the case the two columns
    // exist for.
    const occupations = resolveOccupations(job({ anzsco2022: ['224114'], anzsco2013: ['224999'] }));
    expect(occupations).toHaveLength(1);
    expect(occupations[0].codes.map((c) => c.code)).toEqual(['224114', '224999']);
  });

  test('a role across two occupations keeps both', () => {
    const occupations = resolveOccupations(job({ anzsco2022: ['261313', '224114'] }));
    expect(occupations.map((o) => o.name)).toEqual(['Software Engineer', 'Data Analyst']);
  });

  test('each version links to its own ABS page, not to the other one\u2019s', () => {
    // The two classifications live on different ABS sites, and for some occupations the
    // codes differ — so borrowing one link for both would send a reader to a code their
    // visa does not use.
    const [occ] = resolveOccupations(job({ anzsco2022: ['261313'], anzsco2013: ['261313'] }));
    expect(occ.codes.find((c) => c.version === '2022')?.href).toBe(SOFTWARE.urls.anzsco2022);
    expect(occ.codes.find((c) => c.version === '2013')?.href).toBe(SOFTWARE.urls.anzsco2013);
  });

  test('a version with no page of its own stays unlinked', () => {
    // Data Analyst has no 2013 URL in the fixture; it must not inherit the 2022 one.
    const [occ] = resolveOccupations(job({ anzsco2022: ['224114'], anzsco2013: ['224999'] }));
    expect(occ.codes.find((c) => c.version === '2013')?.href).toBeUndefined();
  });

  test('a 2022 code the reference has no entry for falls back to a built URL', () => {
    const [occ] = resolveOccupations(job({ anzsco2022: ['999999'] }));
    expect(occ.codes[0].href).toContain('/9/99/999/9999');
  });

  test('a code the reference has never heard of still shows, named from the CSV', () => {
    const [occ] = resolveOccupations(
      job({ anzsco2022: ['999999'], occupationNames: ['Clinical Coding Specialist'] })
    );
    expect(occ.name).toBe('Clinical Coding Specialist');
    expect(occ.codes[0].code).toBe('999999');
    expect(occ.visas).toEqual([]);
  });

  test('two unknown codes stay two occupations rather than merging under one blank name', () => {
    expect(resolveOccupations(job({ anzsco2022: ['999999', '888888'] }))).toHaveLength(2);
  });

  test('a role with no codes resolves to nothing', () => {
    expect(resolveOccupations(job())).toEqual([]);
  });
});

describe('what the detail page and the filters both read', () => {
  test('the visas are the union across every occupation, deduplicated and sorted', () => {
    expect(pathwayVisasFor(job({ anzsco2022: ['261313', '224114'] }))).toEqual([
      '186',
      '189',
      '482',
    ]);
  });

  test('the assessors are pooled and deduplicated by name', () => {
    setOccupations({ '261313': SOFTWARE, '261312': { ...SOFTWARE, name: 'Developer Programmer' } });
    expect(assessmentsFor(job({ anzsco2022: ['261313', '261312'] }))).toEqual(['ACS']);
    expect(assessorsFor(job({ anzsco2022: ['261313'] }))[0].url).toBe('https://www.acs.org.au/');
  });

  test('the occupation lists are pooled too', () => {
    expect(occupationListsFor(job({ anzsco2022: ['261313', '224114'] }))).toEqual([
      'MLTSSL',
      'CSOL',
    ]);
  });

  test('the codes a role can be filtered by are both versions', () => {
    expect(occupationCodesFor(job({ anzsco2022: ['224114'], anzsco2013: ['224999'] }))).toEqual([
      '224114',
      '224999',
    ]);
  });
});

describe('the reference itself', () => {
  test('a code resolves to its occupation name', () => {
    expect(occupationName('261313')).toBe('Software Engineer');
    expect(occupationName('000000')).toBe('');
  });

  test('listing occupations does not repeat one that has two codes', () => {
    const names = listOccupations().map((o) => o.name);
    expect(names).toEqual(['Data Analyst', 'Software Engineer']);
  });

  test('an occupation carries both codes, so the admin can write both columns', () => {
    const analyst = listOccupations().find((o) => o.name === 'Data Analyst');
    expect(analyst).toEqual({ name: 'Data Analyst', anzsco2022: '224114', anzsco2013: '224999' });
  });
});

describe('government links', () => {
  test('a known subclass links to its Home Affairs page', () => {
    expect(visaUrl('482')).toContain('skills-in-demand-visa-subclass-482');
  });

  test('the 407 slug drops the word "visa", which an earlier guess got wrong', () => {
    expect(visaUrl('407')).toMatch(/\/training-407$/);
  });

  test('an unknown subclass has no link rather than a guessed one', () => {
    expect(visaUrl('999')).toBeUndefined();
  });

  test('a list label spells out what the acronym means', () => {
    expect(occupationListLabel('MLTSSL')).toBe(
      'MLTSSL - Medium and Long-term Strategic Skills List'
    );
  });
});
