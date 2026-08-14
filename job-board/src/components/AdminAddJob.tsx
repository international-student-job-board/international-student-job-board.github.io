import { useState } from 'react';
import { Company } from '../types';
import { todayISO } from '../format';
import { postJson } from '../devApi';
import { OccupationChoice } from '../references';
import { getConstant, setConstants, ConstantKey } from '../constants';
import { CompanyPicker } from './CompanyPicker';
import { OccupationPicker } from './OccupationPicker';
import { PickOrAdd } from './PickOrAdd';
import {
  FIELDS,
  FIELD_GROUPS,
  OCCUPATION_KEYS,
  CHECKED_KEYS,
  Draft,
  Field,
  emptyDraft,
} from './jobFields';

const byKey = new Map(FIELDS.map((f) => [f.key, f]));

/** A draft becomes a CSV row. */
export function buildJobRow(draft: Draft, occupations: OccupationChoice[]): Record<string, string> {
  const row: Record<string, string> = {};
  for (const field of FIELDS) {
    if (OCCUPATION_KEYS.includes(field.key)) continue;
    row[field.key] = (draft[field.key] ?? '').trim();
  }

  for (const key of CHECKED_KEYS) {
    const answer = (draft[key] ?? '').trim().toLowerCase();
    row[key] = answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : '';
  }

  // Semicolons, because a comma inside a cell only survives quoting and these are read by
  // eye as often as by code.
  row['ANZSCO occupation'] = occupations.map((o) => o.name).join('; ');
  row['ANZSCO 2022'] = occupations.map((o) => o.anzsco2022).filter(Boolean).join('; ');
  row['ANZSCO 2013'] = occupations.map((o) => o.anzsco2013).filter(Boolean).join('; ');
  // The first four digits of an ANZSCO code are its unit group, so the picker
  // fills that column too rather than asking for it again.
  row['ANZSCO unit group'] = Array.from(
    new Set(occupations.map((o) => (o.anzsco2022 || o.anzsco2013).slice(0, 4)).filter(Boolean))
  ).join('; ');
  return row;
}

const blankDraft = (): Draft => ({ ...emptyDraft(), 'Date posted': todayISO() });

export function AdminAddJob() {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [occupations, setOccupations] = useState<OccupationChoice[]>([]);
  const [types, setTypes] = useState<string[]>(() => getConstant('type'));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const setField = (key: string, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  /** Everything the company list already knows, so it isn't retyped per role. */
  const fillFromCompany = (company: Company | undefined) => {
    if (!company) return;
    setDraft((prev) => ({
      ...prev,
      'Company name': company.name,
      Tagline: company.tagline || prev.Tagline,
      Website: company.website || prev.Website,
      LinkedIn: company.linkedin || prev.LinkedIn,
      Profile: company.profile || prev.Profile,
      Segment: company.segment || prev.Segment,
      Type: company.types.join('; ') || prev.Type,
      Industries: company.industries.join('; ') || prev.Industries,
      'Growth stage': company.growthStage || prev['Growth stage'],
      Employees: company.employees || prev.Employees,
      'HQ city': company.hqCity || prev['HQ city'],
      'HQ address': company.hqAddress || prev['HQ address'],
      'Job openings': company.openings ? String(company.openings) : prev['Job openings'],
      'Accredited sponsor':
        company.accreditedSponsor === undefined
          ? prev['Accredited sponsor']
          : company.accreditedSponsor
            ? 'Yes'
            : 'No',
      'Hires international students':
        company.hiresInternationalStudents === undefined
          ? prev['Hires international students']
          : company.hiresInternationalStudents
            ? 'Yes'
            : 'No',
    }));
  };

  const addType = async (value: string) => {
    const reply = await postJson<{ list: string[]; constants?: Record<ConstantKey, string[]> }>(
      '/api/constants',
      { key: 'type', value }
    );
    setTypes(reply.list);
    if (reply.constants) setConstants(reply.constants);
    setField('Job type', value);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      const row = buildJobRow(draft, occupations);
      const reply = await postJson<{ job: Record<string, string> }>('/api/jobs', row);
      setStatus('saved');
      setMessage(`Saved as job #${reply.job['Job ID']}. Reload the board to see it.`);
      setDraft(blankDraft());
      setOccupations([]);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not save the role.');
    }
  };

  const renderField = (field: Field) => {
    const id = `admin-${field.key.replace(/\s+/g, '-').toLowerCase()}`;
    const value = draft[field.key] ?? '';

    // Two fields are not plain inputs: the company name is matched against the company list
    // so the employer's details fill themselves in, and the job type is a pick-list that
    // can be added to.
    if (field.key === 'Company name') {
      return (
        <CompanyPicker
          key={field.key}
          id={id}
          label={field.label}
          required
          value={value}
          onChange={(next) => setField('Company name', next)}
          onMatch={fillFromCompany}
          hint="Start typing to match a company already on the list."
        />
      );
    }

    if (field.key === 'Job type') {
      return (
        <PickOrAdd
          key={field.key}
          id={id}
          label={field.label}
          options={types}
          value={value}
          onChange={(next) => setField('Job type', next)}
          onAdd={addType}
        />
      );
    }

    return (
      <div className="field" key={field.key}>
        <label className="label-text" htmlFor={id}>
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
        {field.hint && <span className="field-hint">{field.hint}</span>}
        {field.type === 'textarea' ? (
          <textarea
            id={id}
            value={value}
            rows={3}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => setField(field.key, e.target.value)}
          />
        ) : field.type === 'select' ? (
          <select id={id} value={value} onChange={(e) => setField(field.key, e.target.value)}>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={field.type === 'date' ? 'date' : 'text'}
            value={value}
            placeholder={field.placeholder}
            required={field.required}
            onChange={(e) => setField(field.key, e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="about admin-page">
      <header className="about-intro">
        <h1>Add a job</h1>
        <p>
          Local only. Saving appends one row to <code>content/jobs.csv</code> — the same file the
          board reads, in the same shape as an imported row, so a role added here is
          indistinguishable from one that arrived in the CSV.
        </p>
      </header>

      <form className="job-form about-section" onSubmit={submit} noValidate>
        {FIELD_GROUPS.map((group) => (
          <fieldset className="field-group" key={group.title}>
            <legend>{group.title}</legend>
            <div className="job-form-grid">
              {group.keys.map((key) => {
                const field = byKey.get(key);
                return field ? renderField(field) : null;
              })}
            </div>
          </fieldset>
        ))}

        <fieldset className="field-group">
          <legend>Occupation</legend>
          <OccupationPicker selected={occupations} onChange={setOccupations} />
        </fieldset>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving . . .' : 'Save to jobs.csv'}
          </button>
          {status === 'saved' && (
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload the board
            </button>
          )}
        </div>

        {message && (
          <p className={status === 'error' ? 'form-error' : 'form-note'} role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
