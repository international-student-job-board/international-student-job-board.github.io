import { loadCompanies, sortCompanies, searchCompanies, findCompany, Company } from './companies';

const HEADERS_OLD =
  'Company name,Segment,Type,Website,Growth stage,Launch year,Employees,Industries,HQ city,HQ address,Tagline,LinkedIn,Profile,Job openings,Total funding (AUD),Status,Sponsor visa available,Hires international students';

const HEADERS_NEW =
  'Company name,Segment,Type,Website,Growth stage,Employees,Industries,HQ city,HQ address,Tagline,LinkedIn,Profile,Job openings,Accredited sponsor,Hires international students';

const stubCsv = (text: string) => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => text,
  });
};

// loadCompanies memoises, so each test needs a fresh module registry.
const freshLoad = async (text: string) => {
  jest.resetModules();
  stubCsv(text);
  const mod: typeof import('./companies') = require('./companies');
  return mod.loadCompanies();
};

const company = (over: Partial<Company> = {}): Company =>
  ({
    name: 'Acme',
    segment: '',
    types: [],
    industries: [],
    website: '',
    growthStage: '',
    employees: '',
    hqCity: '',
    hqAddress: '',
    tagline: '',
    linkedin: '',
    profile: '',
    openings: 0,
    accreditedSponsor: undefined,
    hiresInternationalStudents: undefined,
    ...over,
  }) as Company;

describe('reading the companies CSV', () => {
  test('a row becomes a company', async () => {
    const [c] = await freshLoad(
      `${HEADERS_NEW}\nAcme,startup,saas;ai,https://acme.test,early growth,11-50,fintech;health,Melbourne,"Cremorne VIC 3121",We build things,,,4,Yes,No`
    );
    expect(c.name).toBe('Acme');
    expect(c.types).toEqual(['saas', 'ai']);
    expect(c.industries).toEqual(['fintech', 'health']);
    expect(c.hqAddress).toBe('Cremorne VIC 3121');
    expect(c.openings).toBe(4);
    expect(c.accreditedSponsor).toBe(true);
    expect(c.hiresInternationalStudents).toBe(false);
  });

  test('both spellings of the sponsor column are read, so either file works', async () => {
    const old = await freshLoad(
      `${HEADERS_OLD}\nAcme,,,,,,,,,,,,,,,,Yes,Yes`
    );
    expect(old[0].accreditedSponsor).toBe(true);
  });

  test('a blank answer stays unknown rather than becoming "no"', async () => {
    const [c] = await freshLoad(`${HEADERS_NEW}\nAcme,,,,,,,,,,,,,,`);
    expect(c.accreditedSponsor).toBeUndefined();
    expect(c.hiresInternationalStudents).toBeUndefined();
  });

  test('rows with no company name are dropped', async () => {
    const list = await freshLoad(`${HEADERS_NEW}\nAcme,,,,,,,,,,,,,,\n,,,,,,,,,,,,,,`);
    expect(list).toHaveLength(1);
  });

  test('a failed fetch reports rather than returning an empty list', async () => {
    jest.resetModules();
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 });
    const mod: typeof import('./companies') = require('./companies');
    await expect(mod.loadCompanies()).rejects.toThrow(/404/);
  });
});

describe('ordering and searching', () => {
  const list = [
    company({ name: 'Zeta', openings: 2 }),
    company({ name: 'Acme', openings: 2, industries: ['fintech'] }),
    company({ name: 'Beta', openings: 9 }),
  ];

  test('most roles first, ties broken by name so the order never shuffles', () => {
    expect(sortCompanies(list, 'openings').map((c) => c.name)).toEqual(['Beta', 'Acme', 'Zeta']);
  });

  test('alphabetically when asked', () => {
    expect(sortCompanies(list, 'name').map((c) => c.name)).toEqual(['Acme', 'Beta', 'Zeta']);
  });

  test('an exact name beats a partial one', () => {
    expect(searchCompanies(list, 'beta')[0].name).toBe('Beta');
  });

  test('an industry matches when no name does', () => {
    expect(searchCompanies(list, 'fintech').map((c) => c.name)).toEqual(['Acme']);
  });

  test('an empty query narrows nothing', () => {
    expect(searchCompanies(list, '  ')).toHaveLength(3);
  });

  test('lookup ignores case, so a typed name still matches', () => {
    expect(findCompany(list, 'aCmE')?.name).toBe('Acme');
    expect(findCompany(list, 'nobody')).toBeUndefined();
  });
});
