import { metaFor, jobPostingSchema, websiteSchema } from './seo';
import { setOccupations } from './references';
import { Job } from './types';

const ORIGIN = 'https://example.test';

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: '7',
    title: 'Graduate Software Engineer',
    type: 'Full-time',
    occupationNames: [],
    anzsco2022: ['261313'],
    anzsco2013: [],
    city: 'Melbourne',
    country: 'Australia',
    posted: '2026-07-01',
    applyUrl: 'https://acme.test/apply',
    company: {
      name: 'Acme',
      segment: '',
      types: [],
      industries: [],
      website: 'https://acme.test',
      growthStage: '',
      employees: '',
      hqCity: 'Melbourne',
      hqAddress: '',
      tagline: 'We build things',
      linkedin: '',
      profile: '',
      openings: 1,
      accreditedSponsor: true,
      hiresInternationalStudents: undefined,
    },
    ...over,
  }) as Job;

beforeEach(() =>
  setOccupations({
    '261313': {
      name: 'Software Engineer',
      codes: { anzsco2022: '261313' },
      lists: ['MLTSSL'],
      visas: ['189'],
      assessors: [],
    },
  })
);

describe('what each address tells a search engine', () => {
  test('a role leads with the role, not with the site', () => {
    const meta = metaFor('jobs', job(), ORIGIN);
    expect(meta.title.startsWith('Graduate Software Engineer at Acme')).toBe(true);
    expect(meta.url).toBe(`${ORIGIN}/jobs/7`);
  });

  test('its description says what someone would have searched for', () => {
    const meta = metaFor('jobs', job(), ORIGIN);
    expect(meta.description).toContain('Melbourne, Australia');
    expect(meta.description).toContain('Software Engineer');
    expect(meta.description).toContain('international students');
  });

  test('every page has its own title and canonical, not the home page’s', () => {
    const pages = (['jobs', 'companies', 'about', 'post'] as const).map((r) =>
      metaFor(r, null, ORIGIN)
    );
    expect(new Set(pages.map((p) => p.title)).size).toBe(4);
    expect(new Set(pages.map((p) => p.url)).size).toBe(4);
  });

  test('the board itself is the canonical root', () => {
    expect(metaFor('jobs', null, ORIGIN).url).toBe(`${ORIGIN}/`);
  });
});

describe('JobPosting structured data', () => {
  const schema = () =>
    jobPostingSchema(job(), `${ORIGIN}/jobs/7`, '2026-09-01') as Record<string, any>;

  test('it carries the fields Google requires of a job posting', () => {
    const s = schema();
    expect(s['@type']).toBe('JobPosting');
    expect(s.title).toBe('Graduate Software Engineer');
    expect(s.datePosted).toBe('2026-07-01');
    expect(s.hiringOrganization.name).toBe('Acme');
    expect(s.jobLocation.address.addressLocality).toBe('Melbourne');
    expect(s.description.length).toBeGreaterThan(0);
  });

  test('it expires when the listing does, not later', () => {
    // The board drops roles two months after they are posted; markup that outlived that
    // would advertise a role the site has already stopped showing.
    expect(schema().validThrough).toBe('2026-09-01');
  });

  test('the description is assembled from the file, never invented', () => {
    // There is no employer-written description in the CSV, so every clause has to trace
    // back to a column.
    const s = schema();
    expect(s.description).toContain('Acme');
    expect(s.description).toContain('We build things');
    expect(s.description).toContain('Software Engineer');
  });

  test('a field the file does not have is left out rather than guessed', () => {
    const bare = jobPostingSchema(
      job({ posted: '', type: '' }),
      `${ORIGIN}/jobs/7`,
      ''
    ) as Record<string, any>;
    expect(bare.datePosted).toBeUndefined();
    expect(bare.employmentType).toBeUndefined();
    expect(bare.validThrough).toBeUndefined();
  });

  test('the pages that are not a role describe the site instead', () => {
    expect((websiteSchema(ORIGIN) as Record<string, any>)['@type']).toBe('WebSite');
  });
});
