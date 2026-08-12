import { useState } from 'react';
import { FIELDS, LIST_KEYS, emptyDraft, Draft } from './jobFields';
import { listOccupations, resolveOccupation } from '../references';
import { getConstants, ConstantKey } from '../constants';
import { AddOccupation, NewOccupation } from './AddOccupation';
import { AnzscoPicker } from './AnzscoPicker';
import { CompanyPicker } from './CompanyPicker';
import { postJson } from '../devApi';
import { isStartAsap, START_ASAP, todayISO } from '../format';
import { Company } from '../companies';
import { PickOrAdd } from './PickOrAdd';
import { VisaTagPicker, pipeToList, toggleInPipe } from './VisaTagPicker';
import { TagSelect } from './TagSelect';

// Fields owned by the occupation picker, visa tags, or a pick-or-add constant;
// everything else renders as a normal input. anzsco + skill_assessment come
// from the chosen occupation; the visa fields are tags.
const CONSTANT_JOB_FIELDS: { key: string; constant: ConstantKey; label: string }[] = [
  { key: 'job_level', constant: 'jobLevel', label: 'Level' },
  { key: 'type', constant: 'type', label: 'Type' },
  { key: 'education_level', constant: 'educationLevel', label: 'Education needed' },
];

const CUSTOM_KEYS = [
  'arrangement',
  'company',
  'company_about',
  'company_url',
  'anzsco',
  'skill_assessment',
  'visa_eligible',
  'visa_pathways',
  'skills',
  ...CONSTANT_JOB_FIELDS.map((c) => c.key),
];

const GENERIC_FIELDS = FIELDS.filter((f) => !CUSTOM_KEYS.includes(f.key));

/**
 * The plain fields, in the order someone actually transcribes an ad, grouped
 * under headings rather than run together. Anything not listed here still
 * renders, under "Anything else" — a hardcoded grouping that silently dropped
 * a new field would be a trap, and jobFields.ts is edited often.
 */
const FIELD_GROUPS: { legend: string; keys: string[] }[] = [
  { legend: 'The role', keys: ['title', 'location', 'salary', 'summary'] },
  { legend: 'Dates', keys: ['start_date', 'posted', 'closes'] },
  { legend: 'Applying', keys: ['apply_url'] },
  {
    legend: 'Who posted it',
    keys: [
      'contact_public',
      'contact_name',
      'contact_position',
      'contact_linkedin',
      'contact_website',
      'contact_email',
    ],
  },
];

const GROUPED_KEYS = FIELD_GROUPS.flatMap((g) => g.keys);
const UNGROUPED = GENERIC_FIELDS.filter((f) => !GROUPED_KEYS.includes(f.key));

const toggle = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

/** The values held outside the draft, by their own controls. */
export interface CustomValues {
  occCodes: string[];
  eligible: string[];
  arrangements: string[];
  /** Only the pathways the chosen occupations don't already supply. */
  extraPathways: string[];
}

/**
 * The jobs.json record: the plain fields, plus every value held by a control of
 * its own.
 *
 * Both halves matter. A field listed in CUSTOM_KEYS is skipped by the loop
 * below, so it has to be written back here explicitly — the company fields
 * moved onto the CompanyPicker and were dropped from the record for exactly
 * that reason, which the dev server reported as "title and company are
 * required" on a form where both were plainly filled in.
 */
export function buildJobRecord(draft: Draft, custom: CustomValues): Record<string, string> {
  const record: Record<string, string> = {};

  // Every field the draft holds, whatever renders it. This used to walk
  // GENERIC_FIELDS — the list of fields *without* a custom control — which
  // silently dropped everything that had one: the company, and the level, type
  // and education pickers. How a field is saved has nothing to do with which
  // widget draws it, and tying the two together lost data twice.
  for (const field of FIELDS) {
    const value = (draft[field.key] ?? '').trim();
    if (!value) continue;
    record[field.key] = LIST_KEYS.includes(field.key)
      ? value.split(/[|,]/).map((v) => v.trim()).filter(Boolean).join('|')
      : value;
  }

  // Yes / no / never said, written the way jobs.json spells it. "Not
  // specified" is stored by leaving the field out entirely, which is what the
  // loader reads as "nobody said".
  const sponsored = draft.employer_sponsored?.trim().toLowerCase();
  delete record.employer_sponsored;
  if (sponsored === 'yes' || sponsored === 'no') record.employer_sponsored = sponsored;

  // The consent flag only needs recording when it was given.
  const publish = draft.contact_public?.trim().toLowerCase();
  delete record.contact_public;
  if (publish === 'yes') record.contact_public = 'yes';

  // The company: its own picker, and the key jobs.json is grouped by.
  const company = draft.company?.trim();
  if (company) record.company = company;
  if (draft.company_about?.trim()) record.company_about = draft.company_about.trim();
  if (draft.company_url?.trim()) record.company_url = draft.company_url.trim();

  if (custom.occCodes.length) record.anzsco = custom.occCodes.join('|');
  if (custom.eligible.length) record.visa_eligible = custom.eligible.join('|');
  if (custom.arrangements.length) record.arrangement = custom.arrangements.join('|');
  if (custom.extraPathways.length) record.visa_pathways = custom.extraPathways.join('|');
  if (draft.skills?.trim()) record.skills = draft.skills.trim();

  return record;
}

/**
 * A blank form. The pick-or-add fields are cleared because emptyDraft() seeds
 * every select with its first option, and for these that would save whichever
 * level, type or education happens to sit first in constants.json on a form
 * nobody touched. Their control shows "Choose . . ." for an empty value.
 */
const blankDraft = (): Draft => ({
  ...emptyDraft(),
  ...Object.fromEntries(CONSTANT_JOB_FIELDS.map((c) => [c.key, ''])),
  // Today, because that is when this listing is being added. Editable for a
  // role transcribed later than it was found.
  posted: todayISO(),
});

export function AdminAddJob() {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [constants, setConstants] = useState(getConstants);
  const [occupations, setOccupations] = useState(() => listOccupations());
  // Full visa lists for occupations added this session (the imported reference
  // only refreshes after a rebuild).
  const [sessionVisas, setSessionVisas] = useState<Record<string, string[]>>({});
  const [occEntries, setOccEntries] = useState<string[]>([]); // "code name" each
  const [adding, setAdding] = useState(''); // code currently being written up
  // Whether the typed company is on the Melbourne CSV. Undefined until the
  // list has loaded and a name has been typed.
  const [matchedCompany, setMatchedCompany] = useState<Company | undefined>();
  const [eligible, setEligible] = useState<string[]>([]);
  const [arrangements, setArrangements] = useState<string[]>([]);
  const [pathway, setPathway] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // A company already on the list brings its own one-liner and website, so the
  // admin doesn't retype what the CSV already says. Blanks only.
  const onCompanyMatch = (company: Company | undefined) => {
    setMatchedCompany(company);
    if (!company) return;
    setDraft((d) => ({
      ...d,
      company_about: d.company_about.trim() || company.tagline,
      company_url: d.company_url.trim() || company.website,
    }));
  };

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus('idle');
  };

  // Persist a new value to a constant list and add it to the in-session options.
  const addConstant = async (key: ConstantKey, value: string) => {
    const body = await postJson<{ list: string[] }>('/api/constants', { key, value });
    setConstants((prev) => ({ ...prev, [key]: body.list }));
  };

  const occupationVisaCodes = (code: string): string[] => {
    if (sessionVisas[code]) return sessionVisas[code];
    return Array.from(new Set(resolveOccupation(code, '').visas.map((v) => v.code)));
  };

  // Whether an occupation has a full write-up (visas, assessor, lists) in
  // occupations.json, as opposed to merely being a code on the ANZSCO list.
  const isFleshedOut = (code: string) => occupations.some((o) => o.code === code);

  /**
   * The picker takes any of the 1,400-odd ANZSCO occupations, so a chosen code
   * may or may not have a reference entry yet. If it does, its visas prefill
   * the pathway tags; if it doesn't, the add-occupation form opens with the
   * code and name already filled from the list, leaving only the details a
   * human has to judge — the assessor, the lists and the visas.
   */
  const codeOf = (entry: string) => entry.match(/\b(\d{6})\b/)?.[1] ?? '';
  const occCodes = occEntries.map(codeOf).filter(Boolean);
  const missing = occCodes.filter((code) => !isFleshedOut(code));

  const selectOccupations = (entries: string[]) => {
    setOccEntries(entries);
    setStatus('idle');
    // "Can lead to" is prefilled from the union of every chosen occupation's
    // visas, which is what the job will end up offering anyway.
    const codes = entries.map(codeOf).filter(Boolean);
    setPathway(
      Array.from(new Set(codes.filter(isFleshedOut).flatMap(occupationVisaCodes)))
    );
  };

  const handleOccupationAdded = (occ: NewOccupation) => {
    setOccupations((prev) =>
      prev.some((o) => o.code === occ.code)
        ? prev.map((o) => (o.code === occ.code ? { code: occ.code, name: occ.name } : o))
        : [...prev, { code: occ.code, name: occ.name }].sort((a, b) => a.code.localeCompare(b.code))
    );
    setSessionVisas((prev) => ({ ...prev, [occ.code]: occ.visaCodes }));
    setOccEntries((prev) =>
      prev.some((e) => codeOf(e) === occ.code) ? prev : [...prev, `${occ.code} ${occ.name}`]
    );
    setPathway((prev) => Array.from(new Set([...prev, ...occ.visaCodes])));
    setAdding('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = GENERIC_FIELDS.filter((f) => f.required && !draft[f.key].trim());
    if (missing.length) {
      setStatus('error');
      setMessage(`Please fill in: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    // jobs.json is grouped by company, so the admin needs one even though the
    // public form doesn't: without it a role has no group to sit under.
    if (!draft.company.trim()) {
      setStatus('error');
      setMessage('Please give the company a name; the file is grouped by it.');
      return;
    }
    if (!occCodes.length) {
      setStatus('error');
      setMessage('Please choose at least one occupation first.');
      return;
    }
    if (missing.length) {
      setStatus('error');
      setMessage(
        `${missing.join(', ')} ${missing.length > 1 ? 'are not' : "isn't"} in occupations.json ` +
          `yet — write up the assessor, lists and visas first so the job can link them.`
      );
      return;
    }

    // Only the pathways the occupations don't already provide. The tags above
    // are prefilled from the chosen occupations, so writing them back would
    // copy into every job a fact occupations.json already states once, and the
    // two would drift the moment the reference file is corrected.
    const fromOccupations = new Set(occCodes.flatMap(occupationVisaCodes));
    const record = buildJobRecord(draft, {
      occCodes,
      eligible,
      arrangements,
      extraPathways: pathway.filter((code) => !fromOccupations.has(code)),
    });

    setStatus('saving');
    setMessage('');
    try {
      const body = await postJson<{ job: { id: string } }>('/api/jobs', record);
      setStatus('saved');
      setMessage(`Saved as job #${body.job.id} in jobs.json. Reload to see it in the list.`);
      setDraft(blankDraft());
      setEligible([]);
      setArrangements([]);
      setPathway([]);
      setOccEntries([]);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : "Couldn't save the job.");
    }
  };

  /** One plain field. Shared by every group, so moving a field between groups
      is an edit to FIELD_GROUPS and nothing else. */
  const renderField = (field: (typeof GENERIC_FIELDS)[number]) => (
    <div
      key={field.key}
      className={`field ${field.type === 'textarea' ? 'field-wide' : ''}`}
    >
      <label htmlFor={`admin-${field.key}`}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>

      {field.type === 'date-asap' ? (
        /* One field, two ways to answer it. Ticking the box replaces the date
           rather than sitting beside it, so a date and "as soon as possible"
           can never both be set and leave the reader guessing which won. */
        <>
          <input
            id={`admin-${field.key}`}
            type="date"
            value={isStartAsap(draft[field.key]) ? '' : draft[field.key]}
            disabled={isStartAsap(draft[field.key])}
            onChange={(e) => setField(field.key, e.target.value)}
          />
          <label className="tag-check asap-check">
            <input
              type="checkbox"
              checked={isStartAsap(draft[field.key])}
              onChange={(e) => setField(field.key, e.target.checked ? START_ASAP : '')}
            />
            Starts as soon as possible
          </label>
        </>
      ) : field.type === 'textarea' ? (
        <textarea
          id={`admin-${field.key}`}
          value={draft[field.key]}
          placeholder={field.placeholder}
          rows={3}
          maxLength={field.maxLength}
          onChange={(e) => setField(field.key, e.target.value)}
        />
      ) : field.type === 'select' ? (
        <select
          id={`admin-${field.key}`}
          value={draft[field.key]}
          onChange={(e) => setField(field.key, e.target.value)}
        >
          {field.options!.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`admin-${field.key}`}
          type={field.type === 'url' ? 'url' : field.type === 'date' ? 'date' : 'text'}
          value={draft[field.key]}
          placeholder={field.placeholder}
          required={field.required}
          maxLength={field.maxLength}
          onChange={(e) => setField(field.key, e.target.value)}
        />
      )}

      <div className="field-foot">
        {field.hint && <span className="field-hint">{field.hint}</span>}
        {field.maxLength && (
          <span className="field-count">
            {(draft[field.key] ?? '').length}/{field.maxLength}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="about admin-page">
      <header className="about-intro">
        <h1>Add a job</h1>
        <p>
          Local only. Saving writes the role into <code>public/jobs.json</code> and any new
          occupation into <code>src/data/occupations.json</code>, so the board reads it the same
          way it will read a database later.
        </p>
      </header>

      <form className="job-form about-section" onSubmit={submit} noValidate>
        {/* Company — matched against the Melbourne CSV so its blurb and link
            come from one place. */}
        <div className="job-form-grid">
          <CompanyPicker
            id="admin-company"
            label="Company"
            required
            value={draft.company}
            onChange={(v) => setField('company', v)}
            onMatch={onCompanyMatch}
            hint="Picking a listed company fills in its one-liner and link."
          />
          <div className="field">
            <label htmlFor="admin-company-url">Company link</label>
            <input
              id="admin-company-url"
              type="url"
              value={draft.company_url}
              placeholder="https://www.acme.com"
              onChange={(e) => setField('company_url', e.target.value)}
            />
          </div>
          <div className="field field-wide">
            <label htmlFor="admin-company-about">About the company</label>
            <textarea
              id="admin-company-about"
              value={draft.company_about}
              rows={2}
              maxLength={300}
              placeholder="One line on what the company does."
              onChange={(e) => setField('company_about', e.target.value)}
            />
          </div>
        </div>

        {/* The CSV is the source of truth for the startups page, so a company
            that isn't in it needs adding there rather than only here — else it
            has jobs on the board but never appears among the startups. */}
        {draft.company.trim() && !matchedCompany && (
          <p className="job-form-error" role="status">
            {draft.company.trim()} isn't in melbourne_companies_hiring.csv yet. Add a row for it
            (name, website, tagline, industries) so it shows up on the startups page too.
          </p>
        )}

        {/* Occupation — the hub that connects the job to occupations.json */}
        <div className="job-form-grid">
          <AnzscoPicker
            id="admin-occupation"
            label="Occupations (ANZSCO)"
            required
            value={occEntries}
            onChange={selectOccupations}
            hint={
              missing.length
                ? `${missing.join(', ')} still needs writing up before this job can be saved.`
                : 'Add every code the role could be assessed under. Pre-fills the visas below.'
            }
          />
        </div>

        {/* An occupation off the ANZSCO list has a code and a name but nothing
            else; the rest is written up here, once, the first time a job needs
            it. */}
        {missing.length > 0 && !adding && (
          <div className="job-form-actions">
            {missing.map((code) => (
              <button
                key={code}
                type="button"
                className="btn btn-small"
                onClick={() => setAdding(code)}
              >
                Write up {code} for occupations.json
              </button>
            ))}
          </div>
        )}

        {adding && (
          <AddOccupation
            initialCode={adding}
            initialName={(occEntries.find((e) => codeOf(e) === adding) ?? '').replace(
              /^\s*\d{6}\s*/,
              ''
            )}
            onAdded={handleOccupationAdded}
            onCancel={() => setAdding('')}
            assessmentOptions={constants.assessment}
            onAddAssessment={(v) => addConstant('assessment', v)}
          />
        )}

        {/* Visa tags */}
        <div className="job-form-grid">
          <VisaTagPicker
            legend="Apply if you're on"
            selected={eligible}
            onToggle={(code) => setEligible((prev) => toggle(prev, code))}
          />
          <VisaTagPicker
            legend="Can lead to"
            selected={pathway}
            onToggle={(code) => setPathway((prev) => toggle(prev, code))}
          />
        </div>

        {/* Skills */}
        <div className="job-form-grid">
          <TagSelect
            legend="Work arrangement"
            hint="Pick every arrangement the role can be done under."
            options={constants.arrangement}
            selected={arrangements}
            onToggle={(v) => setArrangements((prev) => toggle(prev, v))}
            onAdd={(v) => addConstant('arrangement', v)}
            addLabel="arrangement"
          />

          <TagSelect
            legend="Skills needed"
            hint="Pick skills or add new ones; new tags are saved to constants.json."
            options={constants.skills}
            selected={pipeToList(draft.skills)}
            onToggle={(tag) => setField('skills', toggleInPipe(draft.skills, tag))}
            onAdd={(tag) => addConstant('skills', tag)}
          />
        </div>

        {/* Pick-or-add constant fields */}
        <div className="job-form-grid">
          {CONSTANT_JOB_FIELDS.map((c) => (
            <PickOrAdd
              key={c.key}
              id={`admin-${c.key}`}
              label={c.label}
              options={constants[c.constant]}
              value={draft[c.key]}
              onChange={(v) => setField(c.key, v)}
              onAdd={(v) => addConstant(c.constant, v)}
            />
          ))}
        </div>

        {/* The plain fields, under headings. Same renderer for each, so a
            field moves between groups by editing FIELD_GROUPS alone. */}
        {FIELD_GROUPS.map((group) => {
          const fields = group.keys
            .map((key) => GENERIC_FIELDS.find((f) => f.key === key))
            .filter((f): f is (typeof GENERIC_FIELDS)[number] => Boolean(f));
          if (!fields.length) return null;
          return (
            <fieldset key={group.legend} className="admin-group">
              <legend>{group.legend}</legend>
              <div className="job-form-grid">{fields.map(renderField)}</div>
            </fieldset>
          );
        })}

        {UNGROUPED.length > 0 && (
          <fieldset className="admin-group">
            <legend>Anything else</legend>
            <div className="job-form-grid">{UNGROUPED.map(renderField)}</div>
          </fieldset>
        )}

        {status === 'error' && (
          <p className="job-form-error" role="alert">
            {message}
          </p>
        )}

        {/* Saved state first, then the actions: the confirmation is the thing
            you look for after pressing the button. */}
        {status === 'saved' && (
          <p className="job-form-saved" role="status">
            {message}
          </p>
        )}

        <div className="job-form-actions">
          <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save to jobs.json'}
          </button>
          {status === 'saved' && (
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload the board to see it
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
