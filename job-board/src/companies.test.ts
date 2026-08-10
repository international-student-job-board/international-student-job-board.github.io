import {
  loadCompanies,
  searchCompanies,
  findCompany,
  sortCompanies,
  Company,
} from './companies';

// Two rows straight from the real file, including the quoted address with
// commas that a naive split would break on, and a blank Type column.
const CSV = [
  'Company name,Segment,Type,Website,Growth stage,Launch year,Employees,Industries,HQ city,HQ address,Tagline,LinkedIn,Profile,Job openings,Total funding (AUD),Status,Sponsor visa available,Hires international students',
  '1receipt,startup,big data;saas,https://www.1receipt.io,early stage,2019,2-10,fintech;marketing,Melbourne,"Victoria Street, Carlton, Melbourne, Victoria, Australia","The first true contactless platform for receipts",https://www.linkedin.com/company/1receipt/,https://example.com/p,1,205107,operational,yes,Yes',
  '360BioLabs,scaleup,,https://www.360biolabs.com/,breakout stage,2015,51-200,health,Melbourne,"85, Commercial Road, 3004 Melbourne, Australia",Quality-assured virology services,https://www.linkedin.com/company/360biolabs/,https://example.com/p2,13,,acquired,,',
].join('\n');

let companies: Company[] = [];

beforeAll(async () => {
  (global as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => CSV });
  companies = await loadCompanies();
});

describe('loadCompanies', () => {
  test('reads the columns the cards and the posting form need', () => {
    expect(companies).toHaveLength(2);
    expect(companies[0]).toMatchObject({
      name: '1receipt',
      segment: 'startup',
      website: 'https://www.1receipt.io',
      tagline: 'The first true contactless platform for receipts',
      openings: 1,
    });
  });

  test('semicolon lists become arrays', () => {
    expect(companies[0].types).toEqual(['big data', 'saas']);
    expect(companies[0].industries).toEqual(['fintech', 'marketing']);
  });

  test('a blank column yields an empty list, not one empty string', () => {
    expect(companies[1].types).toEqual([]);
  });

  test('commas inside quoted fields do not shift the columns', () => {
    // If the address had split the row, the tagline would land in the wrong
    // column — this is the assertion that catches it.
    expect(companies[1].tagline).toBe('Quality-assured virology services');
    expect(companies[1].openings).toBe(13);
  });

  test('a missing opening count reads as zero rather than NaN', () => {
    companies.forEach((c) => expect(Number.isFinite(c.openings)).toBe(true));
  });
});

describe('the hand-checked visa columns', () => {
  test('yes in either case reads as true', () => {
    expect(companies[0].sponsorsVisas).toBe(true);
    expect(companies[0].hiresInternationalStudents).toBe(true);
  });

  test('blank means not reviewed, which is false rather than undefined', () => {
    expect(companies[1].sponsorsVisas).toBe(false);
    expect(companies[1].hiresInternationalStudents).toBe(false);
  });
});

describe('sortCompanies', () => {
  test('most roles open first', () => {
    expect(sortCompanies(companies, 'openings').map((c) => c.name)).toEqual([
      '360BioLabs',
      '1receipt',
    ]);
  });

  test('alphabetical', () => {
    expect(sortCompanies(companies, 'name').map((c) => c.name)).toEqual([
      '1receipt',
      '360BioLabs',
    ]);
  });

  test('sorting leaves the caller’s array alone', () => {
    const before = companies.map((c) => c.name);
    sortCompanies(companies, 'name');
    expect(companies.map((c) => c.name)).toEqual(before);
  });
});

describe('searchCompanies', () => {
  test('finds by name', () => {
    expect(searchCompanies(companies, '360')[0].name).toBe('360BioLabs');
  });

  test('finds by industry, so "health" surfaces health companies', () => {
    expect(searchCompanies(companies, 'health')[0].name).toBe('360BioLabs');
  });

  test('finds by what they build', () => {
    expect(searchCompanies(companies, 'saas')[0].name).toBe('1receipt');
  });

  test('an empty query keeps everything', () => {
    expect(searchCompanies(companies, '')).toHaveLength(2);
  });
});

describe('findCompany', () => {
  test('matches regardless of case, since posters type their own name', () => {
    expect(findCompany(companies, '360biolabs')?.tagline).toBe(
      'Quality-assured virology services'
    );
  });

  test('an unknown company is simply not found, not an error', () => {
    expect(findCompany(companies, 'Some New Startup')).toBeUndefined();
    expect(findCompany(companies, '')).toBeUndefined();
  });
});
