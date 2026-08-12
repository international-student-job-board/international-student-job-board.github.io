import { buildJobRecord, CustomValues } from './AdminAddJob';
import { emptyDraft, FIELDS } from './jobFields';

const NOTHING: CustomValues = {
  occCodes: [],
  eligible: [],
  arrangements: [],
  extraPathways: [],
};

const draftWith = (values: Record<string, string>) => ({ ...emptyDraft(), ...values });
const minimal = (extra: Record<string, string> = {}) =>
  buildJobRecord(draftWith({ title: 'Role', company: 'Acme', ...extra }), NOTHING);

describe('the record the admin saves', () => {
  test('carries the company, which its own picker holds', () => {
    // The regression: the company fields moved onto the CompanyPicker and were
    // dropped from the record, so the server refused every save with "title
    // and company are required" on a form where both were filled in.
    const record = minimal({
      company_about: 'We make anvils.',
      company_url: 'https://acme.test',
    });

    expect(record.company).toBe('Acme');
    expect(record.company_about).toBe('We make anvils.');
    expect(record.company_url).toBe('https://acme.test');
    expect(record.title).toBe('Role');
  });

  test('carries every other value held outside the draft', () => {
    const record = buildJobRecord(draftWith({ title: 'Role', company: 'Acme' }), {
      occCodes: ['261313', '261312'],
      eligible: ['485', '500'],
      arrangements: ['Hybrid', 'Remote'],
      extraPathways: ['858'],
    });

    expect(record.anzsco).toBe('261313|261312');
    expect(record.visa_eligible).toBe('485|500');
    expect(record.arrangement).toBe('Hybrid|Remote');
    expect(record.visa_pathways).toBe('858');
  });

  test('leaves out what was not filled in, rather than writing empty strings', () => {
    const record = minimal();

    expect(record).not.toHaveProperty('company_about');
    expect(record).not.toHaveProperty('salary');
    expect(record).not.toHaveProperty('visa_pathways');
    expect(Object.values(record).every((v) => v !== '')).toBe(true);
  });

  test('the two fields the server insists on survive whatever else changes', () => {
    const record = minimal();
    expect(record.title).toBeTruthy();
    expect(record.company).toBeTruthy();
  });
});

describe('sponsorship, which is a claim about someone else', () => {
  test('an untouched form does not claim the employer sponsors visas', () => {
    // The regression: a select defaults to its first option, so with Yes first
    // every job saved without touching this field asserted sponsorship.
    expect(emptyDraft().employer_sponsored).toBe('Not specified');
    expect(minimal({ employer_sponsored: 'Not specified' })).not.toHaveProperty(
      'employer_sponsored'
    );
  });

  test('yes and no are both saved, because both are answers', () => {
    expect(minimal({ employer_sponsored: 'Yes' }).employer_sponsored).toBe('yes');
    expect(minimal({ employer_sponsored: 'No' }).employer_sponsored).toBe('no');
  });
});

describe('the publish-my-details consent', () => {
  test('is recorded only when it was given', () => {
    expect(minimal({ contact_public: 'Yes' }).contact_public).toBe('yes');
    expect(minimal({ contact_public: 'No' })).not.toHaveProperty('contact_public');
  });
});

/**
 * The catch-all. Two fields have gone missing from saved jobs already — the
 * company, then level/type/education — each time because a list that governed
 * *rendering* was also used to decide what got saved. This walks every field
 * there is, so the next one cannot slip through quietly.
 */
describe('every field reaches the record', () => {
  /** Fields deliberately not written from the draft, and why. */
  const HELD_ELSEWHERE: Record<string, string> = {
    anzsco: 'held by the occupation picker, written from occCodes',
    visa_eligible: 'held by the visa tag picker',
    visa_pathways: 'held by the visa tag picker, minus what the occupation gives',
    arrangement: 'held by the arrangement tag picker',
    skill_assessment: 'comes from the occupation, never typed on a job',
    employer_sponsored: 'tri-state: "Not specified" is stored by omission',
    contact_public: 'only recorded when consent was given',
  };

  const filled = FIELDS.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] =
      field.type === 'date' || field.type === 'date-asap' ? '2026-09-01' : `value-${field.key}`;
    return acc;
  }, {});

  const record = buildJobRecord({ ...emptyDraft(), ...filled }, {
    occCodes: ['261313'],
    eligible: ['485'],
    arrangements: ['Hybrid'],
    extraPathways: ['858'],
  });

  FIELDS.filter((f) => !(f.key in HELD_ELSEWHERE)).forEach((field) => {
    test(`${field.key} is saved`, () => {
      expect(record[field.key]).toBeTruthy();
    });
  });

  test('the fields held elsewhere still arrive, from their own controls', () => {
    expect(record.anzsco).toBe('261313');
    expect(record.visa_eligible).toBe('485');
    expect(record.arrangement).toBe('Hybrid');
    expect(record.visa_pathways).toBe('858');
  });

  test('the date the listing went up is saved', () => {
    expect(record.posted).toBe('2026-09-01');
  });
});
