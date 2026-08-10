import { useState } from 'react';
import { JOB_EMAIL, JOB_EMAIL_SUBJECT_PREFIX } from '../links';
import { listOccupations, resolveOccupation, SKILL_OCCUPATION_LIST_URL } from '../references';
import { getConstant } from '../constants';
import { FIELDS, Draft, emptyDraft } from './jobFields';
import { AdminAddJob } from './AdminAddJob';
import { TagSelect } from './TagSelect';
import { pipeToList, toggleInPipe } from './VisaTagPicker';

const IS_LOCAL = process.env.NODE_ENV === 'development';

// Home Affairs "compare employer-sponsored skilled visa options" page.
const EMPLOYER_VISA_URL =
  'https://immi.homeaffairs.gov.au/employer-subsite/Pages/compare-sponsored-skilled-visa-options.aspx';

type Mode = 'choose' | 'pdf' | 'link' | 'form';

// The public form keeps things simple: it collects the occupation and two
// yes/no questions itself, and doesn't ask about specific visa subclasses or
// the skills assessor (the board derives those from the occupation). These keys
// are handled outside the generic field loop.
const FORM_CUSTOM_KEYS = [
  'anzsco',
  'skill_assessment',
  'visa_eligible',
  'visa_pathways',
  'employer_sponsored',
  'skills',
];
const FORM_FIELDS = FIELDS.filter((f) => !FORM_CUSTOM_KEYS.includes(f.key));
const OCCUPATION_OPTIONS = listOccupations();
const SKILL_OPTIONS = getConstant('skills');

const openMailto = (subject: string, body: string) => {
  window.location.href =
    `mailto:${JOB_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
};

// The three questions common to every submission route: occupation, whether
// international students can apply, and whether the role is employer-sponsored.
interface Eligibility {
  anzsco: string;
  intlApply: string;
  employerSponsored: string;
}

function eligibilityLines({ anzsco, intlApply, employerSponsored }: Eligibility): string[] {
  const occ = resolveOccupation((anzsco ?? '').trim(), '');
  const occLabel = [occ.code, occ.name].filter(Boolean).join(' ') || 'Not specified';
  return [
    `ANZSCO occupation: ${occLabel}`,
    `Can international students apply for this role?: ${intlApply}`,
    `Offer employer-sponsored visas?: ${employerSponsored}`,
  ];
}

// Shared occupation + eligibility questions, used by all submission routes so
// they stay consistent. Visa-related controls each link to the government site.
function EligibilityFields({
  value,
  onOccupation,
  onIntl,
  onEmployer,
}: {
  value: Eligibility;
  onOccupation: (v: string) => void;
  onIntl: (v: string) => void;
  onEmployer: (v: string) => void;
}) {
  return (
    <div className="job-form-grid">
      <div className="field field-wide">
        <label htmlFor="elig-occupation">ANZSCO occupation</label>
        <select
          id="elig-occupation"
          value={value.anzsco}
          onChange={(e) => onOccupation(e.target.value)}
        >
          <option value="">Not sure / not listed</option>
          {OCCUPATION_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.code} {o.name}
            </option>
          ))}
        </select>
        <span className="field-hint">
          Optional : : pick the closest match.{' '}
          <a
            className="gov-link"
            href={SKILL_OCCUPATION_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Skilled occupation list
          </a>
        </span>
      </div>

      <div className="field">
        <label htmlFor="elig-intl">
          Can international students apply for this role?<span aria-hidden="true"> *</span>
        </label>
        <select id="elig-intl" value={value.intlApply} onChange={(e) => onIntl(e.target.value)}>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <span className="field-hint">
          This board only lists roles open to international students. Most are on a Student (500) or
          Temporary Graduate (485) visa.
        </span>
      </div>

      <div className="field">
        <label htmlFor="elig-employer">
          Offer employer-sponsored visas?<span aria-hidden="true"> *</span>
        </label>
        <select
          id="elig-employer"
          value={value.employerSponsored}
          onChange={(e) => onEmployer(e.target.value)}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <span className="field-hint">
          Not sure which visa suits?{' '}
          <a className="gov-link" href={EMPLOYER_VISA_URL} target="_blank" rel="noopener noreferrer">
            Compare sponsored visa options
          </a>
        </span>
      </div>
    </div>
  );
}

// Build a readable email body for the "type it in" form: the role fields, then
// the shared occupation + eligibility questions.
function buildFormBody(draft: Draft, elig: Eligibility): string {
  const lines = FORM_FIELDS.map(
    (f) => `${f.label}: ${(draft[f.key] ?? '').replace(/\|/g, ', ').trim()}`
  );
  lines.push(`Skills needed: ${(draft.skills ?? '').replace(/\|/g, ', ').trim()}`);
  return [
    'New role for the International Student Job Board.',
    '',
    ...lines,
    ...eligibilityLines(elig),
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
  // Shared across all three submission routes.
  const [anzsco, setAnzsco] = useState('');
  const [intlApply, setIntlApply] = useState('Yes');
  const [employerSponsored, setEmployerSponsored] = useState('Yes');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const elig: Eligibility = { anzsco, intlApply, employerSponsored };
  const onOccupation = (v: string) => {
    setAnzsco(v);
    setSent(false);
  };
  const onIntl = (v: string) => {
    setIntlApply(v);
    setSent(false);
  };
  const onEmployer = (v: string) => {
    setEmployerSponsored(v);
    setSent(false);
  };

  const reset = (next: Mode) => {
    setMode(next);
    setError('');
    setSent(false);
  };

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSent(false);
  };

  // Every route must answer the two eligibility questions, and the board only
  // lists roles open to international students.
  const eligibilityError = (): string | null => {
    if (!intlApply || !employerSponsored) {
      return 'Please answer whether international students can apply and whether you offer employer-sponsored visas.';
    }
    if (intlApply === 'No') {
      return "This board only lists roles open to international students, so we can't accept a role that isn't. If that changes, we'd love to hear from you!";
    }
    return null;
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = FIELDS.filter((f) => f.required && !draft[f.key].trim());
    if (missing.length) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }
    const eligErr = eligibilityError();
    if (eligErr) {
      setError(eligErr);
      return;
    }
    if (pipeToList(draft.skills).length < 5) {
      setError('Please select at least 5 skills so students can see what the role needs.');
      return;
    }
    setError('');
    openMailto(`${JOB_EMAIL_SUBJECT_PREFIX}${draft.title.trim()}`, buildFormBody(draft, elig));
    setSent(true);
  };

  const submitPdf = (e: React.FormEvent) => {
    e.preventDefault();
    const eligErr = eligibilityError();
    if (eligErr) {
      setError(eligErr);
      return;
    }
    setError('');
    const subject = `${JOB_EMAIL_SUBJECT_PREFIX}${pdfTitle.trim() || 'PDF advert attached'}`;
    const body = [
      'PLEASE ATTACH YOUR JOB ADVERT PDF TO THIS EMAIL BEFORE SENDING.',
      '',
      'Hi,',
      '',
      "I'd like to list this role on the International Student Job Board - the advert is in the attached PDF.",
      ...(pdfTitle.trim() ? ['', `Role: ${pdfTitle.trim()}`] : []),
      '',
      ...eligibilityLines(elig),
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
    const eligErr = eligibilityError();
    if (eligErr) {
      setError(eligErr);
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
      ...eligibilityLines(elig),
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
          Every job on this board is seen by international students
          and graduates in Melbourne who are eager to learn, grow and build a career here.
        </p>
      </header>

      {IS_LOCAL && <AdminAddJob />}

      <section className="about-section" aria-labelledby="post-form-heading">
        <h2 id="post-form-heading">Submit a role</h2>

        <p className="post-wip-note">
          We're currently refactoring our <i>Post a job</i> section, so for now roles will have to be sent via email!
          Thank you for taking the time, we really appreciate it c:
        </p>

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
              Fill out the details below and click <i>Open email to attach PDF & send</i> button below, attach your PDF (or PDFs if multiple) to the email
              that opens, and press send.
            </p>

            <div className="job-form-grid">
              <div className="field">
                <label htmlFor="pdf-title">Role title</label>
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

            <EligibilityFields
              value={elig}
              onOccupation={onOccupation}
              onIntl={onIntl}
              onEmployer={onEmployer}
            />

            {error && (
              <p className="job-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="job-form-actions">
              <button type="submit" className="btn btn-primary">
                Open email to attach PDF &amp; send
              </button>
            </div>

            {sent && (
              <p className="about-note" role="status">
                Your email app should have opened, attach your PDF and press send.
                If nothing opened, please email us at <code>{JOB_EMAIL}</code>.
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
              Paste the link to your advert and hit <i>Submit via email</i> button below. Your email app opens
              with the body filled in, addressed to us, all you've gotta do is press send!
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

            <EligibilityFields
              value={elig}
              onOccupation={onOccupation}
              onIntl={onIntl}
              onEmployer={onEmployer}
            />

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
                Your email app should have opened with your link - press send to finish. If nothing
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
              Fill in the role details and click <i>Submit via email</i>. Your email app opens with
              everything filled in and addressed to us, all you've gotta do is just press send!
            </p>

            <EligibilityFields
              value={elig}
              onOccupation={onOccupation}
              onIntl={onIntl}
              onEmployer={onEmployer}
            />

            <div className="job-form-grid">
              {FORM_FIELDS.map((f) => (
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
                      rows={3}
                      maxLength={f.maxLength}
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

            <div className="job-form-grid">
              <TagSelect
                legend="Skills needed *"
                hint="Select at least 5, or add your own with ＋ Add."
                options={SKILL_OPTIONS}
                selected={pipeToList(draft.skills)}
                onToggle={(tag) => setField('skills', toggleInPipe(draft.skills, tag))}
              />
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
                Your email app should have opened with the role details - press send to finish. If
                nothing opened, email us directly at <code>{JOB_EMAIL}</code>.
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
