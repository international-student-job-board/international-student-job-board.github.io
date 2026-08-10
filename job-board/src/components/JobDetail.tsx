import { Job } from '../types';
import { formatDate } from '../format';
import { visaUrl, resolveOccupation, VISA_DISCLAIMER } from '../references';
import { InfoTooltip } from './InfoTooltip';

const LIST_NAMES: Record<string, string> = {
  MLTSSL: 'Medium and Long-term Strategic Skills List',
  CSOL: 'Core Skills Occupation List',
  STSOL: 'Short-term Skilled Occupation List',
  ROL: 'Regional Occupation List',
};

// Each visa code links to its official Home Affairs listing when we know the
// page; unknown codes stay as plain (unclickable) pills.
function Pills({ items }: { items: string[] }) {
  if (!items.length) return <>Not specified</>;
  return (
    <span className="pill-list">
      {items.map((v) => {
        const href = visaUrl(v);
        return href ? (
          <a
            key={v}
            className="pill pill-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Subclass ${v} - official Home Affairs page`}
          >
            {v}
          </a>
        ) : (
          <span key={v} className="pill">
            {v}
          </span>
        );
      })}
    </span>
  );
}

// A single free-text value (skills assessor, ANZSCO occupation) that becomes a
// link out to its official source when we can resolve one.
function Reference({ text, href }: { text: string; href?: string }) {
  if (!text) return <>Not specified</>;
  if (!href) return <>{text}</>;
  return (
    <a
      className="reference-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  );
}

// Tag an outbound apply URL with UTM parameters so the employer's analytics
// attributes the visit to this board (belt-and-braces alongside the referrer
// header). Left untouched for mailto: or non-http links.
function applyHref(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    u.searchParams.set('utm_source', window.location.hostname);
    u.searchParams.set('utm_medium', 'referral');
    u.searchParams.set('utm_campaign', 'apply');
    return u.toString();
  } catch {
    return trimmed;
  }
}

// Apply action. When the employer takes applications by email (a mailto: link)
// the button says so and opens the mail client in place; otherwise it opens the
// employer's application page in a new tab.
function ApplyButton({ url }: { url: string }) {
  const isEmail = url.trim().toLowerCase().startsWith('mailto:');
  return (
    <a
      className={`btn btn-primary${isEmail ? ' btn-email' : ''}`}
      href={isEmail ? url : applyHref(url)}
      {...(isEmail
        ? {}
        : {
            target: '_blank',
            // `noopener` (not `noreferrer`) so the employer site still receives
            // our domain as the referrer; the policy sends our origin.
            rel: 'noopener',
            referrerPolicy: 'strict-origin-when-cross-origin' as const,
          })}
    >
      {isEmail ? (
        <>
          <span className="btn-icon btn-icon-mail" aria-hidden="true" />
          Apply by email
        </>
      ) : (
        <>
          Apply on employer site
          <span className="btn-icon btn-icon-end" aria-hidden="true">
            ↗
          </span>
        </>
      )}
    </a>
  );
}

export function JobDetail({ job }: { job: Job }) {
  const occupation = resolveOccupation(job.anzsco, job.skillAssessment);
  const occupationLabel = [occupation.code, occupation.name].filter(Boolean).join(' ');
  const applyByEmail = job.applyUrl.trim().toLowerCase().startsWith('mailto:');
  // "Can lead to" = the job's own pathway visas plus every visa the ANZSCO
  // occupation can be used for, de-duplicated by subclass (occupations can list
  // a code more than once for different streams).
  const pathwayVisas = Array.from(
    new Set([...job.visaPathways, ...occupation.visas.map((v) => v.code)])
  );
  return (
    <article className="job-detail" aria-labelledby="job-detail-title">
      {/* Who, then what, then when — the company and title read as one unit
          and the dates and sponsorship badge as another. The badge sits with
          the dates rather than above the title: a solid pill is the heaviest
          thing in this block, and ahead of the headline it takes the lead
          away from it. */}
      <p className="detail-company">
        {job.companyUrl ? (
          <a
            className="company-link"
            href={job.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {job.company}
          </a>
        ) : (
          job.company
        )}
      </p>

      <h1 id="job-detail-title" className="detail-title">
        {job.title}
      </h1>

      <div className="detail-meta">
        <span className="detail-posted">
          Posted {formatDate(job.posted)} · Closes {formatDate(job.closes)}
        </span>
        {job.employerSponsored && (
          <span className="flag flag-sponsor">Visa sponsorship available</span>
        )}
      </div>

      <section>
      <h2 className="detail-heading">In a nutshell</h2>
      <ul className="detail-facts">
        <li>
          <span className="fact-label">Location</span>
          {job.location}
        </li>
        <li>
          <span className="fact-label">Type</span>
          {job.type}
        </li>
        <li>
          <span className="fact-label">Arrangement</span>
          {job.arrangement}
        </li>
        <li>
          <span className="fact-label">Salary</span>
          {job.salary}
        </li>
        <li>
          <span className="fact-label">Education</span>
          {job.educationLevel || 'Not specified'}
        </li>
        <li>
          <span className="fact-label">Level</span>
          {job.jobLevel}
        </li>
      </ul>
      </section>

      <section className="visa-box" aria-labelledby="visa-heading">
        <h2 id="visa-heading">
          Visa &amp; pathway{' '}
          <InfoTooltip text={VISA_DISCLAIMER} label="Visa guidance disclaimer" />
        </h2>
        <ul className="visa-facts">
          <li>
            <span className="fact-label">Apply if you're on</span>
            <Pills items={job.visaEligible} />
          </li>
          <li>
            <span className="fact-label">Can lead to</span>
            <Pills items={pathwayVisas} />
          </li>
          <li>
            <span className="fact-label">Skills assessment</span>
            <Reference text={occupation.assessment} href={occupation.assessmentHref} />
          </li>
          <li>
            <span className="fact-label">ANZSCO occupation</span>
            <Reference text={occupationLabel} href={occupation.anzscoHref} />
          </li>
          {occupation.lists.length > 0 && (
            <li>
              <span className="fact-label">Occupation lists <InfoTooltip
                label="What the occupation lists mean"
                text={occupation.lists
                  .map((l) => `${l} - ${LIST_NAMES[l] ?? l}`)
                  .join('\n')}
              /></span>
              {occupation.lists.join(', ')}{' '}
            </li>
          )}
          <li>
            <span className="fact-label">Employer sponsorship</span>
            {job.employerSponsored ? 'Available' : 'Not offered'}
          </li>
        </ul>

        <div className="detail-actions">
          <ApplyButton url={job.applyUrl} />
        </div>
      </section>

      {job.companyAbout && (<section className="detail-section">
          <h2>About the employer</h2>
          <p className="detail-about">{job.companyAbout}</p>
          </section>
          )}


      {job.summary && (
        <section className="detail-section">
          <h2>About the role</h2>
          <p className="detail-description">{job.summary}</p>
        </section>
      )}

      {job.skills.length > 0 && (
        <section className="detail-section">
          <h2>Skills</h2>
          <ul className="detail-tags" aria-label="Skills needed">
            {job.skills.map((skill) => (
              <li key={skill} className="tag">
                {skill}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="detail-actions">
        <ApplyButton url={job.applyUrl} />
        <p className="apply-note">
          {applyByEmail
            ? "Applications for this role are sent by email to the employer."
            : "Applications are handled on the employer's preferred website."}
        </p>
      </div>
    </article>
  );
}
