import { sortCompanies, searchCompanies, findCompany, Company } from './companies';

const HEADERS_OLD =
  'Company name,Segment,Type,Website,Growth stage,Launch year,Employees,Industries,HQ city,HQ address,Tagline,LinkedIn,Profile,Job openings,Total funding (AUD),Status,Sponsor visa available,Hires international students';

const HEADERS_NEW =
  'Company name,Segment,Type,Website,Growth stage,Employees,Industries,HQ city,HQ address,Tagline,LinkedIn,Profile,Job openings,Accredited sponsor,Hires international students';

const HEADERS_GLASSDOOR = `${HEADERS_NEW},Glassdoor rating,Glassdoor reviews,Glassdoor URL`;

const HEADERS_BOARD_ROLES = `${HEADERS_NEW},Board roles`;

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
    boardRoles: 0,
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

  test('the Glassdoor columns are read when present, and skipped when not', async () => {
    const [rated] = await freshLoad(
      `${HEADERS_GLASSDOOR}\nAcme,,,,,,,,,,,,,,,3.2,346,https://www.glassdoor.com.au/Overview/x.htm`
    );
    expect(rated.glassdoorRating).toBe(3.2);
    expect(rated.glassdoorReviews).toBe(346);
    expect(rated.glassdoorUrl).toContain('glassdoor');

    const [plain] = await freshLoad(`${HEADERS_NEW}\nAcme,,,,,,,,,,,,,,`);
    expect(plain.glassdoorRating).toBeUndefined();
    expect(plain.glassdoorUrl).toBeUndefined();
  });

  test('"Board roles" is read when present, and defaults to 0 for a file written before it existed', async () => {
    const [withBoardRoles] = await freshLoad(`${HEADERS_BOARD_ROLES}\nAcme,,,,,,,,,,,,,,,3`);
    expect(withBoardRoles.boardRoles).toBe(3);

    const [older] = await freshLoad(`${HEADERS_NEW}\nAcme,,,,,,,,,,,,,,`);
    expect(older.boardRoles).toBe(0);
  });

  test('both spellings of the sponsor column are read, so either file works', async () => {
    const old = await freshLoad(`${HEADERS_OLD}\nAcme,,,,,,,,,,,,,,,,Yes,Yes`);
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
    // openings (Dealroom's own count) deliberately disagrees with boardRoles (what's actually
    // listed) here, so the "most roles" sort test below only passes if it's reading the right
    // one.
    company({ name: 'Zeta', openings: 2, boardRoles: 1 }),
    company({ name: 'Acme', openings: 2, boardRoles: 5, industries: ['fintech'] }),
    company({ name: 'Beta', openings: 9, boardRoles: 0 }),
  ];

  test("most roles first (roles actually on the board, not the CSV's own count), ties broken by name", () => {
    expect(sortCompanies(list, 'openings').map((c) => c.name)).toEqual(['Acme', 'Zeta', 'Beta']);
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
