import { useEffect, useState } from 'react';
import { visaName, anzscoUrl, assessmentUrl } from '../references';
import { AnzscoOccupation, loadAnzscoCodes } from '../anzsco';
import { postJson } from '../devApi';
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
  initialCode = '',
  initialName = '',
}: {
  onAdded: (occ: NewOccupation) => void;
  onCancel: () => void;
  assessmentOptions: string[];
  onAddAssessment: (value: string) => Promise<void>;
  /** Prefilled from the ANZSCO list when a job needs an occupation writing up,
      so only the parts that take judgement are left to enter. */
  initialCode?: string;
  initialName?: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [anzscoRows, setAnzscoRows] = useState<AnzscoOccupation[]>([]);
  const [assessment, setAssessment] = useState('');
  const [lists, setLists] = useState<string[]>([]);
  const [visas, setVisas] = useState<string[]>([]);
  const [extraVisas, setExtraVisas] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // The occupation name is not something to retype — it is already published
  // against the code in the ANZSCO list, and typing it by hand is how a name
  // ends up not matching the official one.
  useEffect(() => {
    loadAnzscoCodes()
      .then(setAnzscoRows)
      .catch(() => setAnzscoRows([]));
  }, []);

  const officialTitle = /^\d{6}$/.test(code.trim())
    ? anzscoRows.find((row) => row.code === code.trim())?.title
    : undefined;

  // Fills the name in as soon as a code resolves, and keeps it in step if the
  // code is edited. Still editable afterwards: an entry can need a clearer
  // name than the classification gives it.
  useEffect(() => {
    if (officialTitle) setName(officialTitle);
  }, [officialTitle]);

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

    // The whole point of a reference entry is the visa data: an occupation with
    // none contributes nothing that the ANZSCO list doesn't already give us,
    // and a job linked to it would show an empty "can lead to".
    if (!visaList.length) {
      setStatus('error');
      setMessage(
        'Add at least one visa this occupation can be used for.'
      );
      return;
    }

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
      await postJson('/api/occupations', record);
      onAdded({ code: record.code, name: record.name, visaCodes: visaList.map((v) => v.code) });
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error ? err.message : "Couldn't save the occupation."
      );
    }
  };

  return (
    <div className="add-occ">
      <h3>Add an occupation to occupations.json</h3>
      <p className="field-hint">
        Enter the code and the rest fills in: the name comes from the ANZSCO list, and the ABS
        and assessor links are built for you. The visas are the part only you can supply, and the
        entry won't save without them.
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
          <span className="field-hint">
            {officialTitle
              ? 'Filled from the ANZSCO list — edit only if it needs to read differently.'
              : 'Fills in automatically once the code matches the ANZSCO list.'}
          </span>
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
          legend="Visas this occupation can be used for *"
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
