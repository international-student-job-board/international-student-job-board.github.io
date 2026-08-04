import { useState } from 'react';
import { visaName, anzscoUrl, assessmentUrl } from '../references';
import { PickOrAdd } from './PickOrAdd';
import { VisaTagPicker } from './VisaTagPicker';

const LIST_OPTIONS = ['MLTSSL', 'CSOL', 'STSOL', 'ROL'];

export interface NewOccupation {
  code: string;
  name: string;
  visaCodes: string[];
}

const toggle = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

// Local-only form that writes a new occupation into src/data/occupations.json
// via the dev server. anzsco/assessment links are derived here so the stored
// record is complete.
export function AddOccupation({
  onAdded,
  onCancel,
  assessmentOptions,
  onAddAssessment,
}: {
  onAdded: (occ: NewOccupation) => void;
  onCancel: () => void;
  assessmentOptions: string[];
  onAddAssessment: (value: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [assessment, setAssessment] = useState('');
  const [lists, setLists] = useState<string[]>([]);
  const [visas, setVisas] = useState<string[]>([]);
  const [extraVisas, setExtraVisas] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setStatus('error');
      setMessage('Enter a 6-digit ANZSCO code (e.g. 261313).');
      return;
    }
    if (!name.trim()) {
      setStatus('error');
      setMessage('Enter the occupation name.');
      return;
    }

    // Extra visas are entered as "code - name" pairs, comma-separated, matching
    // the shape stored in occupations.json (e.g. "858 - Global Talent").
    const extra = extraVisas
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const m = entry.match(/^(\d{3,6})\s*-\s*(.+)$/);
        if (m) return { code: m[1], name: m[2].trim() };
        const codeOnly = entry.match(/^\d{3,6}$/);
        return codeOnly ? { code: entry, name: visaName(entry) } : null;
      })
      .filter((v): v is { code: string; name: string } => v !== null);

    // Chip selections first, then extras, de-duplicated by code.
    const byCode = new Map<string, { code: string; name: string }>();
    for (const c of visas) byCode.set(c, { code: c, name: visaName(c) });
    for (const v of extra) if (!byCode.has(v.code)) byCode.set(v.code, v);
    const visaList = Array.from(byCode.values());

    const record = {
      code: code.trim(),
      name: name.trim(),
      anzscoUrl: anzscoUrl(code.trim()),
      assessment: assessment.trim(),
      assessmentUrl: assessmentUrl(assessment.trim()),
      lists,
      visas: visaList,
    };

    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/occupations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      onAdded({ code: record.code, name: record.name, visaCodes: visaList.map((v) => v.code) });
    } catch (err) {
      setStatus('error');
      setMessage(
        `Couldn't save the occupation - is the dev server running? (npm run dev-server). ${
          err instanceof Error ? err.message : ''
        }`
      );
    }
  };

  return (
    <div className="add-occ">
      <h3>Add an occupation to occupations.json</h3>
      <p className="field-hint">
        This writes a new entry into the reference file so it becomes selectable and links its
        visas, assessor and ANZSCO page automatically.
      </p>

      <div className="job-form-grid">
        <div className="field">
          <label htmlFor="occ-code">
            ANZSCO code<span aria-hidden="true"> *</span>
          </label>
          <input
            id="occ-code"
            type="text"
            inputMode="numeric"
            value={code}
            placeholder="261313"
            onChange={(e) => setCode(e.target.value)}
          />
          <span className="field-hint">The 6-digit code. Its ABS page link is built from this.</span>
        </div>

        <div className="field">
          <label htmlFor="occ-name">
            Occupation name<span aria-hidden="true"> *</span>
          </label>
          <input
            id="occ-name"
            type="text"
            value={name}
            placeholder="Software Engineer"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <PickOrAdd
          id="occ-assessment"
          label="Skills assessing authority"
          placeholder="e.g. VETASSESS"
          options={assessmentOptions}
          value={assessment}
          onChange={setAssessment}
          onAdd={onAddAssessment}
          hint="Its assessment page link is matched from the name."
        />

        <div className="field field-wide">
          <span className="label-text">Occupation lists</span>
          <div className="visa-tags">
            {LIST_OPTIONS.map((l) => (
              <label key={l} className="tag-check">
                <input
                  type="checkbox"
                  checked={lists.includes(l)}
                  onChange={() => setLists((prev) => toggle(prev, l))}
                />
                {l}
              </label>
            ))}
          </div>
        </div>

        <VisaTagPicker
          legend="Visas this occupation can be used for"
          selected={visas}
          onToggle={(code) => setVisas((prev) => toggle(prev, code))}
        />

        <div className="field field-wide">
          <label htmlFor="occ-extra-visas">Other visas not listed above</label>
          <input
            id="occ-extra-visas"
            type="text"
            value={extraVisas}
            placeholder="858 - Global Talent, 124 - Distinguished Talent"
            onChange={(e) => setExtraVisas(e.target.value)}
          />
          <span className="field-hint">
            Format each as <code>code - name</code> (matching the other visas), comma-separated.
          </span>
        </div>
      </div>

      {status === 'error' && (
        <p className="job-form-error" role="alert">
          {message}
        </p>
      )}

      <div className="job-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={status === 'saving'}
          onClick={submit}
        >
          {status === 'saving' ? 'Saving…' : 'Save occupation'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
