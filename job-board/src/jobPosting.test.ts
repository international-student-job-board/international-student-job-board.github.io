// The JobPosting a role's page carries, checked against Google's job posting guide
// (https://developers.google.com/search/docs/appearance/structured-data/job-posting) - and the
// app's copy checked against the static generator's, which writes the page Google fetches first.

import { jobPosting, schemaTitle, PostingInput } from './jobPosting';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const generator = require('../scripts/job-posting.js');

const role = (over: Partial<PostingInput> = {}): PostingInput => ({
  id: '91378315',
  url: 'https://international-student-job-board.github.io/jobs/91378315/',
  validThrough: '2026-12-14',
  title: 'Data Platform Engineer',
  company: 'EHPlabs',
  website: 'https://ehplabs.com',
  tagline: 'Health and wellness brand',
  city: 'Ultimo',
  locationCity: 'Sydney',
  locationState: 'New South Wales',
  posted: '2026-10-14',
  employmentType: 'Full-time',
  levels: ['Mid'],
  arrangements: ['Hybrid'],
  education: ['Bachelor'],
  occupations: ['Data Engineer'],
  salary: { source: '', currency: '' },
  ...over,
});

type Posting = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const posting = (over: Partial<PostingInput> = {}) => jobPosting(role(over)) as Posting;

describe('the app writes exactly what the static page does', () => {
  const cases: Partial<PostingInput>[] = [
    {},
    { title: 'SEASONAL CASUALS - PARAFIELD', city: 'Parafield', locationState: 'South Australia' },
    { title: 'Account Executive, Mid-Market | $220-240k OTE' },
    { arrangements: ['Remote'], employmentType: 'Contract', levels: ['Internship'] },
    {
      salary: { source: 'advert', min: 95000, max: 110000, currency: 'AUD' },
      education: ['Master', 'Diploma'],
    },
    { salary: { source: 'advert', min: 120000, max: 120000, currency: 'USD' } },
    { salary: { source: 'levels.fyi', minAud: 100000, maxAud: 140000, currency: 'AUD' } },
    { website: '', tagline: '', city: '', locationCity: '', locationState: '', posted: '' },
    { title: 'Nanny Job: North Richmond, NSW, 2754', city: 'North Richmond' },
  ];
  test.each(cases.map((c, i) => [i, c]))('case %i', (_, over) => {
    expect(jobPosting(role(over as Partial<PostingInput>))).toEqual(
      generator.jobPosting(role(over as Partial<PostingInput>))
    );
  });
});

describe('required properties', () => {
  test('title, description, datePosted, hiringOrganization and jobLocation are all there', () => {
    const p = posting();
    expect(p['@type']).toBe('JobPosting');
    expect(p.title).toBe('Data Platform Engineer');
    expect(p.datePosted).toBe('2026-10-14');
    expect(p.hiringOrganization).toEqual({
      '@type': 'Organization',
      name: 'EHPlabs',
      sameAs: 'https://ehplabs.com',
    });
    // jobLocation must carry addressCountry.
    expect(p.jobLocation.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Ultimo',
      addressRegion: 'NSW',
      addressCountry: 'AU',
    });
  });

  test('the description is HTML, with paragraph breaks and a list of the role facts', () => {
    const { description } = posting();
    expect(description).toMatch(
      /^<p>Data Platform Engineer at EHPlabs in Ultimo, New South Wales\.<\/p>/
    );
    expect(description).toContain('<ul><li>Employment type: Full-time</li>');
    expect(description).toContain('<li>Education: Bachelor</li>');
    expect(description).not.toBe(posting().title);
  });

  test('the description escapes what it quotes', () => {
    expect(posting({ company: 'A & B <Labs>' }).description).toContain('A &amp; B &lt;Labs&gt;');
  });
});

describe('the title is the job only', () => {
  const title = (text: string, over: Partial<PostingInput> = {}) =>
    schemaTitle(role({ title: text, ...over }));

  test('no salary, job code or date', () => {
    expect(title('Account Executive, Mid-Market | $220-240k OTE')).toBe(
      'Account Executive, Mid-Market'
    );
    expect(title('People & Culture Operations Coordinator (NCS0008)')).toBe(
      'People & Culture Operations Coordinator'
    );
    expect(title('Senior Product Designer 01.09.2026')).toBe('Senior Product Designer');
  });

  test('no address - but a place that is part of the job stays', () => {
    expect(title('SEASONAL CASUALS - PARAFIELD', { city: 'Parafield' })).toBe('Seasonal Casuals');
    expect(title('Nanny Job: North Richmond, NSW, 2754', { city: 'North Richmond' })).toBe(
      'Nanny Job'
    );
    expect(title('Software Engineer (Remote)')).toBe('Software Engineer');
    expect(title('2027 Graduate Program - OSP Design & Engineering')).toBe(
      '2027 Graduate Program - OSP Design & Engineering'
    );
  });

  test('no shouting or special characters, acronyms kept', () => {
    expect(title('Now Hiring! Support Workers')).toBe('Support Workers');
    expect(title('DISABILITY SUPPORT WORKERS AND SIL SUPERVISORS')).toBe(
      'Disability Support Workers and SIL Supervisors'
    );
    expect(title('ED RMO')).toBe('ED RMO');
  });
});

describe('recommended properties', () => {
  test('employmentType uses Google values, and an internship is INTERN', () => {
    expect(posting().employmentType).toBe('FULL_TIME');
    expect(posting({ employmentType: 'Casual' }).employmentType).toBe('PART_TIME');
    expect(posting({ employmentType: 'Contract', levels: ['Internship'] }).employmentType).toEqual([
      'CONTRACTOR',
      'INTERN',
    ]);
    expect(posting({ employmentType: '' }).employmentType).toBeUndefined();
  });

  test('baseSalary is only the salary the employer stated, never an estimate', () => {
    expect(
      posting({ salary: { source: 'levels.fyi', minAud: 100000, maxAud: 140000, currency: 'AUD' } })
        .baseSalary
    ).toBeUndefined();
    expect(
      posting({ salary: { source: 'advert', min: 95000, max: 110000, currency: 'AUD' } }).baseSalary
    ).toEqual({
      '@type': 'MonetaryAmount',
      currency: 'AUD',
      value: { '@type': 'QuantitativeValue', minValue: 95000, maxValue: 110000, unitText: 'YEAR' },
    });
  });

  test('a salary stated in another currency is given in that currency', () => {
    const p = posting({
      salary: { source: 'advert', min: 120000, max: 120000, currency: 'USD', minAud: 180000 },
    });
    expect(p.baseSalary.currency).toBe('USD');
    expect(p.baseSalary.value).toEqual({
      '@type': 'QuantitativeValue',
      value: 120000,
      unitText: 'YEAR',
    });
  });

  test('a fully remote role is TELECOMMUTE, says so, and names where applicants can be', () => {
    const p = posting({ arrangements: ['Remote'] });
    expect(p.jobLocationType).toBe('TELECOMMUTE');
    expect(p.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'Australia' });
    expect(p.description).toContain('100% remote');
  });

  test('a hybrid role, or one that is remote only some of the time, is not', () => {
    expect(posting({ arrangements: ['Hybrid'] }).jobLocationType).toBeUndefined();
    expect(posting({ arrangements: ['Remote', 'Hybrid'] }).jobLocationType).toBeUndefined();
    expect(posting({ arrangements: ['Remote', 'Hybrid'] }).description).not.toContain('100%');
  });

  test('educationRequirements is the lowest credential the advert names', () => {
    expect(posting({ education: ['Master', 'Bachelor'] }).educationRequirements).toEqual({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'bachelor degree',
    });
    expect(posting({ education: ['Final year of degree'] }).educationRequirements).toBeUndefined();
  });

  test('validThrough, identifier and directApply', () => {
    const p = posting();
    expect(p.validThrough).toBe('2026-12-14');
    expect(p.identifier).toEqual({
      '@type': 'PropertyValue',
      name: 'International Student Job Board',
      value: '91378315',
    });
    expect(p.directApply).toBe(false);
  });
});
