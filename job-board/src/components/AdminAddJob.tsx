import { useState } from 'react';
import { FIELDS, LIST_KEYS, emptyDraft, Draft } from './jobFields';
import { listOccupations, resolveOccupation } from '../references';
import { getConstants, ConstantKey } from '../constants';
import { AddOccupation, NewOccupation } from './AddOccupation';
import { PickOrAdd } from './PickOrAdd';
import { VisaTagPicker, pipeToList, toggleInPipe } from './VisaTagPicker';
import { TagSelect } from './TagSelect';

// Fields owned by the occupation picker, visa tags, or a pick-or-add constant;
// everything else renders as a normal input. anzsco + skill_assessment come
// from the chosen occupation; the visa fields are tags.
const CONSTANT_JOB_FIELDS: { key: string; constant: ConstantKey; label: string }[] = [
  { key: 'job_level', constant: 'jobLevel', label: 'Level' },
  { key: 'type', constant: 'type', label: 'Type' },
  { key: 'arrangement', constant: 'arrangement', label: 'Arrangement' },
  { key: 'education_level', constant: 'educationLevel', label: 'Education needed' },
];

const CUSTOM_KEYS = [
  'anzsco',
  'skill_assessment',
  'visa_eligible',
  'visa_pathways',
  'skills',
  ...CONSTANT_JOB_FIELDS.map((c) => c.key),
];

const GENERIC_FIELDS = FIELDS.filter((f) => !CUSTOM_KEYS.includes(f.key));

const toggle = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

// Build the jobs.json record: skip empty and custom fields, pipe-join lists.
function toJobRecord(draft: Draft): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of GENERIC_FIELDS) {
    const value = (draft[field.key] ?? '').trim();
    if (!value) continue;
    record[field.key] = LIST_KEYS.includes(field.key)
      ? value.split(/[|,]/).map((v) => v.trim()).filter(Boolean).join('|')
      : value;
  }
  return record;
}

export function AdminAddJob() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [constants, setConstants] = useState(getConstants);
  const [occupations, setOccupations] = useState(() => listOccupations());
  // Full visa lists for occupations added this session (the imported reference
  // only refreshes after a rebuild).
  const [sessionVisas, setSessionVisas] = useState<Record<string, string[]>>({});
  const [occCode, setOccCode] = useState(''); // '' none, '__add__' add-mode, or a code
  const [eligible, setEligible] = useState<string[]>([]);
  const [pathway, setPathway] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus('idle');
  };

  // Persist a new value to a constant list and add it to the in-session options.
  const addConstant = async (key: ConstantKey, value: string) => {
    const res = await fetch('/api/constants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    setConstants((prev) => ({ ...prev, [key]: body.list }));
  };

  const occupationVisaCodes = (code: string): string[] => {
    if (sessionVisas[code]) return sessionVisas[code];
    return Array.from(new Set(resolveOccupation(code, '').visas.map((v) => v.code)));
  };

  const selectOccupation = (value: string) => {
    setOccCode(value);
    setStatus('idle');
    if (value && value !== '__add__') {
      // Connect the occupation to the job: prefill "can lead to" from its visas.
      setPathway(occupationVisaCodes(value));
    }
  };

  const handleOccupationAdded = (occ: NewOccupation) => {
    setOccupations((prev) =>
      prev.some((o) => o.code === occ.code)
        ? prev.map((o) => (o.code === occ.code ? { code: occ.code, name: occ.name } : o))
        : [...prev, { code: occ.code, name: occ.name }].sort((a, b) => a.code.localeCompare(b.code))
    );
    setSessionVisas((prev) => ({ ...prev, [occ.code]: occ.visaCodes }));
    setOccCode(occ.code);
    setPathway(occ.visaCodes);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = GENERIC_FIELDS.filter((f) => f.required && !draft[f.key].trim());
    if (missing.length) {
      setStatus('error');
      setMessage(`Please fill in: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    if (!occCode || occCode === '__add__') {
      setStatus('error');
      setMessage('Please choose an occupation (or add one) first.');
      return;
    }

    const record = toJobRecord(draft);
    record.anzsco = occCode;
    if (eligible.length) record.visa_eligible = eligible.join('|');
    if (pathway.length) record.visa_pathways = pathway.join('|');
    if (draft.skills?.trim()) record.skills = draft.skills.trim();

    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setStatus('saved');
      setMessage(`Saved as job #${body.job.id} in jobs.json. Reload to see it in the list.`);
      setDraft(emptyDraft());
      setEligible([]);
      setPathway([]);
      setOccCode('');
    } catch (err) {
      setStatus('error');
      setMessage(
        `Couldn't save - is the dev server running? (npm run dev-server). ${
          err instanceof Error ? err.message : ''
        }`
      );
    }
  };

  return (
    <section className="about-section admin-panel" aria-labelledby="admin-heading">
      <h2 id="admin-heading">➕ Add a job (local only)</h2>
      <p>
        This panel only shows when running the site locally. It writes the role straight into{' '}
        <code>public/jobs.json</code>, and the occupation you pick links its visas, assessor and
        ANZSCO page from <code>occupations.json</code>.
      </p>

      <form className="job-form" onSubmit={submit} noValidate>
        {/* Occupation — the hub that connects the job to occupations.json */}
        <div className="job-form-grid">
          <div className="field field-wide">
            <label htmlFor="admin-occupation">
              Occupation (ANZSCO)<span aria-hidden="true"> *</span>
            </label>
            <select
              id="admin-occupation"
              value={occCode}
              onChange={(e) => selectOccupation(e.target.value)}
            >
              <option value="">Choose an occupation…</option>
              {occupations.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code} {o.name}
                </option>
              ))}
              <option value="__add__">＋ Add a new occupation…</option>
            </select>
            <span className="field-hint">Pre-fills the visas and assessor below.</span>
          </div>
        </div>

        {occCode === '__add__' && (
          <AddOccupation
            onAdded={handleOccupationAdded}
            onCancel={() => setOccCode('')}
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

        {/* Everything else */}
        <div className="job-form-grid">
          {GENERIC_FIELDS.map((f) => (
            <div key={f.key} className={`field ${f.type === 'textarea' ? 'field-wide' : ''}`}>
              <label htmlFor={`admin-${f.key}`}>
                {f.label}
                {f.required && <span aria-hidden="true"> *</span>}
              </label>

              {f.type === 'textarea' ? (
                <textarea
                  id={`admin-${f.key}`}
                  value={draft[f.key]}
                  placeholder={f.placeholder}
                  rows={3}
                  maxLength={f.maxLength}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  id={`admin-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`admin-${f.key}`}
                  type={f.type === 'url' ? 'url' : f.type === 'date' ? 'date' : 'text'}
                  value={draft[f.key]}
                  placeholder={f.placeholder}
                  required={f.required}
                  maxLength={f.maxLength}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}

              <div className="field-foot">
                {f.hint && <span className="field-hint">{f.hint}</span>}
                {f.maxLength && (
                  <span className="field-count">
                    {(draft[f.key] ?? '').length}/{f.maxLength}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {status === 'error' && (
          <p className="job-form-error" role="alert">
            {message}
          </p>
        )}

        <div className="job-form-actions">
          <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Add to jobs.json'}
          </button>
          {status === 'saved' && (
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload to view
            </button>
          )}
        </div>

        {status === 'saved' && (
          <p className="about-note" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
