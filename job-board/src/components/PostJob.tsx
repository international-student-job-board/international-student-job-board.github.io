import { useState } from 'react';
import { JOB_EMAIL, JOB_EMAIL_SUBJECT_PREFIX } from '../links';

type FieldType = 'text' | 'url' | 'date' | 'textarea' | 'select';

interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
}

const FIELDS: Field[] = [
  { key: 'title', label: 'Job title', type: 'text', required: true, placeholder: 'Graduate Software Engineer' },
  { key: 'company', label: 'Company name', type: 'text', required: true, placeholder: 'Acme' },
  { key: 'company_about', label: 'One-line about the company', type: 'text', placeholder: 'What the company does, in a sentence.' },
  { key: 'company_url', label: 'Company link', type: 'url', placeholder: 'https://www.acme.com' },
  { key: 'apply_url', label: 'Application link', type: 'url', required: true, placeholder: 'https://www.acme.com/careers', hint: 'Company careers page, external job board, or an email link.' },
  { key: 'job_level', label: 'Level', type: 'select', options: ['Internship', 'Graduate', 'Junior', 'Mid', 'Senior', 'Other'] },
  { key: 'type', label: 'Type', type: 'select', options: ['Full-time', 'Part-time', 'Casual', 'Contract', 'Internship'] },
  { key: 'arrangement', label: 'Work arrangement', type: 'select', options: ['On-site', 'Hybrid', 'Remote'] },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'Richmond, Melbourne VIC' },
  { key: 'salary', label: 'Salary or pay range', type: 'text', placeholder: '$85,000–$95,000' },
  { key: 'posted', label: 'Application opens', type: 'date' },
  { key: 'closes', label: 'Application closes', type: 'date' },
  { key: 'education_level', label: 'Education needed', type: 'text', placeholder: "Bachelor's (can apply in your final year)" },
  { key: 'summary', label: 'One-sentence summary', type: 'text', placeholder: 'Build and ship product features across a Python and React stack.' },
  { key: 'day_to_day', label: 'A typical day', type: 'textarea', placeholder: 'What the person will actually be doing day to day.' },
  { key: 'skills', label: 'Skills needed', type: 'text', placeholder: 'Software, Backend, Python, React', hint: 'Separate with commas.' },
  { key: 'daily_skills', label: 'Top daily skills', type: 'text', placeholder: 'Python, React, Problem solving', hint: 'Separate with commas.' },
  { key: 'company_values', label: 'Company values', type: 'text', placeholder: 'Trust & transparency, Learning, Inclusion', hint: 'Separate with commas.' },
  { key: 'career_advancement', label: 'Career growth', type: 'textarea', placeholder: 'Where this role can lead.' },
  { key: 'description', label: 'Full description', type: 'textarea', placeholder: 'The full advert.' },
  { key: 'visa_eligible', label: 'Visa(s) a candidate can apply on', type: 'text', placeholder: '485, 500', hint: 'Optional : : Leave blank if unsure. Separate with commas.' },
  { key: 'visa_pathways', label: 'Visa(s) this role can lead to', type: 'text', placeholder: '189, 190, 186', hint: 'Optional : : Separate with commas.' },
  { key: 'skill_assessment', label: 'Skills assessment', type: 'text', placeholder: 'ACS (261313 Software Engineer)', hint: 'Optional' },
  { key: 'employer_sponsored', label: 'Offer employer-sponsored visas?', type: 'select', options: ['No', 'Yes'] },
];

type Draft = Record<string, string>;
type Mode = 'choose' | 'pdf' | 'link' | 'form';

const emptyDraft = (): Draft =>
  FIELDS.reduce((acc, f) => {
    acc[f.key] = f.type === 'select' && f.options ? f.options[0] : '';
    return acc;
  }, {} as Draft);

const openMailto = (subject: string, body: string) => {
  window.location.href =
    `mailto:${JOB_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
};

// Build a readable email body from the filled-in form, grouped like the advert.
function buildFormBody(draft: Draft): string {
  return [
    'New role for the International Student Job Board.',
    '',
    ...FIELDS.map((f) => `${f.label}: ${(draft[f.key] ?? '').trim()}`),
    '',
    'Submitted via the Post a job form.',
  ].join('\r\n');
}

export function PostJob() {
  const [mode, setMode] = useState<Mode>('choose');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfNote, setPdfNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const reset = (next: Mode) => {
    setMode(next);
    setError('');
    setSent(false);
  };

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSent(false);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = FIELDS.filter((f) => f.required && !draft[f.key].trim());
    if (missing.length) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    setError('');
    openMailto(`${JOB_EMAIL_SUBJECT_PREFIX}${draft.title.trim()}`, buildFormBody(draft));
    setSent(true);
  };

  const submitPdf = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `${JOB_EMAIL_SUBJECT_PREFIX}${pdfTitle.trim() || 'PDF advert attached'}`;
    const body = [
      'PLEASE ATTACH YOUR JOB ADVERT PDF TO THIS EMAIL BEFORE SENDING.',
      '',
      'Hi,',
      '',
      "I'd like to list this role on the International Student Job Board — the advert is in the attached PDF.",
      ...(pdfTitle.trim() ? ['', `Role: ${pdfTitle.trim()}`] : []),
      ...(pdfNote.trim() ? ['', pdfNote.trim()] : []),
      '',
      'Thanks!',
    ].join('\r\n');
    openMailto(subject, body);
    setSent(true);
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) {
      setError('Please add the job link.');
      return;
    }
    setError('');
    const subject = `${JOB_EMAIL_SUBJECT_PREFIX}${linkTitle.trim() || 'Job link'}`;
    const body = [
      'Hi,',
      '',
      "I'd like to list this role on the International Student Job Board. Here's the link to the advert:",
      '',
      linkUrl.trim(),
      ...(linkTitle.trim() ? ['', `Role: ${linkTitle.trim()}`] : []),
      '',
      'Thanks!',
    ].join('\r\n');
    openMailto(subject, body);
    setSent(true);
  };

  return (
    <div className="about">
      <header className="about-intro">
        <h1>Hire up-and-coming STEM talent</h1>
        <p>
          List a role in minutes. Every job on the board is seen by international students
          and graduates in Melbourne who are eager to learn, grow and build a career here.
        </p>
      </header>

      <section className="about-section" aria-labelledby="post-form-heading">
        <h2 id="post-form-heading">Submit a role</h2>

        {mode === 'choose' && (
          <>
            <p>How would you like to send us the role?</p>
            <div className="post-choice">
              <button type="button" className="choice-card" onClick={() => reset('pdf')}>
                <h3>Email a PDF job advert</h3>
                <p>Send us your existing advert as a PDF.</p>
              </button>
              <button type="button" className="choice-card" onClick={() => reset('link')}>
                <h3>Email a job link</h3>
                <p>Already listed elsewhere? Send us the link to the advert.</p>
              </button>
              <button type="button" className="choice-card" onClick={() => reset('form')}>
                <h3>Email form</h3>
                <p>No PDF or link? Type the role details and we’ll build the listing.</p>
              </button>
            </div>
          </>
        )}

        {mode === 'pdf' && (
          <form className="job-form" onSubmit={submitPdf} noValidate>
            <button type="button" className="post-back" onClick={() => reset('choose')}>
              ← Back
            </button>
            <p>
              Hit <strong>Open email</strong> below, <strong>attach your PDF</strong> to the email
              that opens, and press send. It’ll reach us at <code>{JOB_EMAIL}</code>.
            </p>

            <div className="job-form-grid">
              <div className="field">
                <label htmlFor="pdf-title">Role title (optional)</label>
                <input
                  id="pdf-title"
                  type="text"
                  value={pdfTitle}
                  placeholder="Graduate Software Engineer"
                  onChange={(e) => {
                    setPdfTitle(e.target.value);
                    setSent(false);
                  }}
                />
              </div>
              <div className="field field-wide">
                <label htmlFor="pdf-note">Anything to add? (optional)</label>
                <textarea
                  id="pdf-note"
                  value={pdfNote}
                  rows={3}
                  placeholder="Extra context, deadlines, or a note for us."
                  onChange={(e) => {
                    setPdfNote(e.target.value);
                    setSent(false);
                  }}
                />
              </div>
            </div>

            <div className="job-form-actions">
              <button type="submit" className="btn btn-primary">
                Open email to attach &amp; send
              </button>
            </div>

            {sent && (
              <p className="about-note" role="status">
                Your email app should have opened — <strong>attach your PDF</strong> and press send.
                If nothing opened, email us at <code>{JOB_EMAIL}</code>.
              </p>
            )}
          </form>
        )}

        {mode === 'link' && (
          <form className="job-form" onSubmit={submitLink} noValidate>
            <button type="button" className="post-back" onClick={() => reset('choose')}>
              ← Back
            </button>
            <p>
              Paste the link to your advert and hit <strong>Submit</strong>. Your email app opens
              with it filled in, addressed to us — just press send.
            </p>

            <div className="job-form-grid">
              <div className="field field-wide">
                <label htmlFor="link-url">
                  Job link<span aria-hidden="true"> *</span>
                </label>
                <input
                  id="link-url"
                  type="url"
                  value={linkUrl}
                  placeholder="https://www.acme.com/careers/graduate-engineer"
                  required
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setSent(false);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="link-title">Role title (optional)</label>
                <input
                  id="link-title"
                  type="text"
                  value={linkTitle}
                  placeholder="Graduate Software Engineer"
                  onChange={(e) => {
                    setLinkTitle(e.target.value);
                    setSent(false);
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="job-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="job-form-actions">
              <button type="submit" className="btn btn-primary">
                Submit via email
              </button>
            </div>

            {sent && (
              <p className="about-note" role="status">
                Your email app should have opened with your link — press send to finish. If nothing
                opened, email us at <code>{JOB_EMAIL}</code>.
              </p>
            )}
          </form>
        )}

        {mode === 'form' && (
          <form className="job-form" onSubmit={submitForm} noValidate>
            <button type="button" className="post-back" onClick={() => reset('choose')}>
              ← Back
            </button>
            <p>
              Fill in the role details and hit <strong>Submit</strong>. Your email app opens with
              everything filled in and addressed to us — just press send.
            </p>

            <div className="job-form-grid">
              {FIELDS.map((f) => (
                <div
                  key={f.key}
                  className={`field ${f.type === 'textarea' ? 'field-wide' : ''}`}
                >
                  <label htmlFor={`f-${f.key}`}>
                    {f.label}
                    {f.required && <span aria-hidden="true"> *</span>}
                  </label>

                  {f.type === 'textarea' ? (
                    <textarea
                      id={`f-${f.key}`}
                      value={draft[f.key]}
                      placeholder={f.placeholder}
                      rows={4}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={`f-${f.key}`}
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
                      id={`f-${f.key}`}
                      type={f.type === 'url' ? 'url' : f.type === 'date' ? 'date' : 'text'}
                      value={draft[f.key]}
                      placeholder={f.placeholder}
                      required={f.required}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}

                  {f.hint && <span className="field-hint">{f.hint}</span>}
                </div>
              ))}
            </div>

            {error && (
              <p className="job-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="job-form-actions">
              <button type="submit" className="btn btn-primary">
                Submit via email
              </button>
            </div>

            {sent && (
              <p className="about-note" role="status">
                Your email app should have opened with the role details — press send to finish. If
                nothing opened, email us directly at <code>{JOB_EMAIL}</code>.
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
