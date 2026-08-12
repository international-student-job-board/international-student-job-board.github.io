import { Job } from '../types';
import { formatDate, formatStart, orNotSpecified, NOT_SPECIFIED } from '../format';
import {
  visaUrl,
  resolveOccupations,
  pathwayVisasFor,
  occupationListUrl,
  occupationListLabel,
  VISA_DISCLAIMER,
} from '../references';
import { InfoTooltip } from './InfoTooltip';
import { OUTBOUND, outboundHref, emailApplyHref, safeHref } from '../outbound';
import { SITE_NAME, SITE_URL } from '../links';

// The skilled-migration lists an occupation sits on. Outlined chips rather than
// the filled pills used for visa subclasses just above them: both are codes
// that link out, but they answer different questions, and one shared style for
// two different kinds of code would invite reading them as one set.
function OccupationLists({ lists }: { lists: string[] }) {
  if (!lists.length) return <>Not specified</>;
  return (
    <span className="value-list">
      {lists.map((list) => {
        const href = occupationListUrl(list);
        const label = occupationListLabel(list);
        return href ? (
          <a
            key={list}
            className="value-chip value-chip-link"
            href={href}
            target="_blank"
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
            title={`${label} - official Home Affairs page`}
          >
            {list}
          </a>
        ) : (
          <span key={list} className="value-chip" title={label}>
            {list}
          </span>
        );
      })}
    </span>
  );
}

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
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
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
  const safe = safeHref(href ?? '');
  if (!safe) return <>{text}</>;
  return (
    <a
      className="reference-link"
      href={safe}
      target="_blank"
      rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
    >
      {text}
    </a>
  );
}

// Apply action. When the employer takes applications by email (a mailto: link)
// the button says so and opens the mail client in place; otherwise it opens the
// employer's application page in a new tab.
function ApplyButton({ url, jobTitle }: { url: string; jobTitle: string }) {
  const isEmail = url.trim().toLowerCase().startsWith('mailto:');
  const href = isEmail
    ? emailApplyHref(url, jobTitle, SITE_NAME, SITE_URL)
    : outboundHref(url, 'apply');

  // A link we can't safely build is no link at all — an empty href would just
  // reload the page and look like the button is broken.
  if (!href) {
    return <p className="apply-note">This role has no working application link yet.</p>;
  }

  return (
    <a
      className={`btn btn-primary${isEmail ? ' btn-email' : ''}`}
      href={href}
      {...(isEmail ? {} : OUTBOUND)}
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
  const occupations = resolveOccupations(job);
  const applyByEmail = job.applyUrl.trim().toLowerCase().startsWith('mailto:');
  const pathwayVisas = pathwayVisasFor(job);
  // Assessors and lists are pooled across every occupation the role maps to,
  // deduplicated — two occupations often share an assessor and a list.
  const assessments = Array.from(
    new Map(
      occupations
        .filter((o) => o.assessment)
        .map((o) => [o.assessment, { text: o.assessment, href: o.assessmentHref }])
    ).values()
  );
  const lists = Array.from(new Set(occupations.flatMap((o) => o.lists)));
  return (
    <article className="job-detail" aria-labelledby="job-detail-title">
      {/* Who, then what, then when — the company and title read as one unit
          and the dates and sponsorship badge as another. The badge sits with
          the dates rather than above the title: a solid pill is the heaviest
          thing in this block, and ahead of the headline it takes the lead
          away from it. */}
      <p className="detail-company">
        {outboundHref(job.companyUrl, 'employer') ? (
          <a
            className="company-link"
            href={outboundHref(job.companyUrl, 'employer')}
            target="_blank"
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
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
        {/* A matched pair, worded the same way round: both halves are about
            the application window, so both read "Applications …". When the role
            itself starts is a fact about the job, and lives with the other
            facts below. */}
        <span className="detail-posted">
          {[
            job.posted ? `Applications open ${formatDate(job.posted)}` : '',
            job.closes ? `Applications close ${formatDate(job.closes)}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'Application dates not specified'}
        </span>
        {job.employerSponsored && (
          <span className="flag flag-sponsor">Visa sponsorship available</span>
        )}
      </div>

      <section>
      <h2 className="detail-heading">In a nutshell</h2>
      <ul className="detail-facts">
        <li>
          <span className="fact-label">Start date</span>
          {formatStart(job.startDate)}
        </li>
        <li>
          <span className="fact-label">Location</span>
          {orNotSpecified(job.location)}
        </li>
        <li>
          <span className="fact-label">Type</span>
          {orNotSpecified(job.type)}
        </li>
        <li>
          <span className="fact-label">
            Arrangement{job.arrangements.length > 1 ? 's' : ''}
          </span>
          {job.arrangements.join(', ') || NOT_SPECIFIED}
        </li>
        <li>
          <span className="fact-label">Salary</span>
          {orNotSpecified(job.salary)}
        </li>
        <li>
          <span className="fact-label">Education</span>
          {orNotSpecified(job.educationLevel)}
        </li>
        <li>
          <span className="fact-label">Level</span>
          {orNotSpecified(job.jobLevel)}
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
            <span className="fact-label">
              Skills assessment{assessments.length > 1 ? 's' : ''}
            </span>
            {assessments.length === 0 ? (
              'Not specified'
            ) : (
              <span className="fact-values">
                {assessments.map((a) => (
                  <Reference key={a.text} text={a.text} href={a.href} />
                ))}
              </span>
            )}
          </li>
          <li>
            <span className="fact-label">
              ANZSCO occupation{occupations.length > 1 ? 's' : ''}
            </span>
            {occupations.length === 0 ? (
              'Not specified'
            ) : (
              <span className="fact-values">
                {occupations.map((occ) => (
                  <Reference
                    key={occ.code || occ.name}
                    text={[occ.code, occ.name].filter(Boolean).join(' ')}
                    href={occ.anzscoHref}
                  />
                ))}
              </span>
            )}
          </li>
          {lists.length > 0 && (
            <li>
              <span className="fact-label">
                Occupation lists{' '}
                <InfoTooltip
                  label="What the occupation lists mean"
                  text={lists.map(occupationListLabel).join('\n')}
                />
              </span>
              <OccupationLists lists={lists} />
            </li>
          )}
          <li>
            <span className="fact-label">Employer sponsorship</span>
            {job.employerSponsored === true
              ? 'Available'
              : job.employerSponsored === false
                ? 'Not offered'
                : NOT_SPECIFIED}
          </li>
        </ul>

        <div className="detail-actions">
          <ApplyButton url={job.applyUrl} jobTitle={job.title} />
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

      {/* Right above the apply action, because that is when knowing who you are
          writing to actually changes what you do. */}
      {/* Both conditions: details we hold but were not given permission to
          publish stay unpublished. */}
      {job.contactPublic && job.contactName && (
        <section className="detail-section hiring-contact">
          <h2>Who posted this</h2>
          {/* Name leads, position sits under it: one is who they are, the other
              is context for it, and stacking says that without a separator. */}
          <p className="hiring-contact-name">{job.contactName}</p>
          {job.contactPosition && (
            <p className="hiring-contact-role">{job.contactPosition}</p>
          )}
          {outboundHref(job.contactLinkedin, 'contact') && (
            <a
              className="reference-link"
              href={outboundHref(job.contactLinkedin, 'contact')}
              {...OUTBOUND}
            >
              LinkedIn profile
            </a>
          )}
        </section>
      )}

      <div className="detail-actions">
        <ApplyButton url={job.applyUrl} jobTitle={job.title} />
        <p className="apply-note">
          {applyByEmail
            ? "Applications for this role are sent by email to the employer."
            : "Applications are handled on the employer's preferred website."}
        </p>
      </div>
    </article>
  );
}
