import { Fragment } from 'react';
import { Job, jobLocation } from '../types';
import { formatDate, orNotSpecified, NOT_SPECIFIED } from '../format';
import {
  visaUrl,
  resolveOccupations,
  pathwayVisasFor,
  assessorsFor,
  occupationListsFor,
  occupationListUrl,
  occupationListLabel,
  VISA_DISCLAIMER,
} from '../references';
import { InfoTooltip } from './InfoTooltip';
import { ShareJob } from './ShareJob';
import { jobShareUrl } from '../App';
import { OUTBOUND, outboundHref, emailApplyHref, safeHref } from '../outbound';
import { SITE_NAME, SITE_URL } from '../links';
import { prettyLabels } from '../labels';

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

/**
 * A role's occupations, each with the codes it is known by:
 *
 *   Electronics Engineer (233411 - 2022, 233411 - 2013)
 *
 * One line per occupation. The name carries the weight and the bracket
 * qualifies it, which is the shape of the sentence being read — a row of
 * equal-looking chips made "233411" and "ANZSCO 2022" run together as one
 * token.
 *
 * Each code links to its own version's page on the ABS. That is worth the two
 * links: subclasses 186 and 482 are assessed against ANZSCO 2022 and every
 * other visa against ANZSCO 2013, the two classifications live on different ABS
 * sites, and for a handful of occupations the codes themselves differ — so a
 * reader following the wrong one is reading about a code their visa does not
 * use. A code with no page stays as plain text rather than borrowing the other
 * version's link.
 */
function Occupations({ occupations }: { occupations: ReturnType<typeof resolveOccupations> }) {
  if (!occupations.length) return <>Not specified</>;
  return (
    <span className="fact-values">
      {occupations.map((occ) => (
        <span className="occupation" key={occ.name || occ.codes[0]?.code}>
          {occ.name && <span className="occupation-name">{occ.codes[0]?.code} {occ.name}</span>}
          <span className="occupation-codes">
            {occ.name ? ' (' : ''}
            {occ.codes.map((c, i) => {
              const text = `${c.version}`;
              return (
                <Fragment key={`${c.version}-${c.code}`}>
                  {i > 0 && ', '}
                  {c.href ? (
                    <a
                      className="reference-link"
                      href={c.href}
                      target="_blank"
                      rel="noopener"
                      referrerPolicy="strict-origin-when-cross-origin"
                      title={`${occ.name || c.code} in the ABS ANZSCO ${c.version} classification`}
                    >
                      {text}
                    </a>
                  ) : (
                    text
                  )}
                </Fragment>
              );
            })}
            {occ.name ? ')' : ''}
          </span>
        </span>
      ))}
    </span>
  );
}

// A single free-text value that becomes a link out to its official source when
// we can resolve one.
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

/** yes / no / nobody has checked — said in words rather than left blank. */
function Answer({ value, yes, no }: { value: boolean | undefined; yes: string; no: string }) {
  if (value === true) return <>{yes}</>;
  if (value === false) return <>{no}</>;
  return <>Not checked yet</>;
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
  const { company } = job;
  const occupations = resolveOccupations(job);
  const applyByEmail = job.applyUrl.trim().toLowerCase().startsWith('mailto:');
  const pathwayVisas = pathwayVisasFor(job);
  const assessors = assessorsFor(job);
  const lists = occupationListsFor(job);
  const companyHref = outboundHref(company.website, 'employer');

  return (
    <article className="job-detail" aria-labelledby="job-detail-title">
      {/* Who, then what, then when — the company and title read as one unit
          and the date and sponsorship badge as another. The badge sits with
          the date rather than above the title: a solid pill is the heaviest
          thing in this block, and ahead of the headline it takes the lead
          away from it.

          The header spans the full width; below it the article splits into a
          reading column and a column of actions. */}
      <header className="detail-head">
        <p className="detail-company">
          {companyHref ? (
            <a
              className="company-link"
              href={companyHref}
              target="_blank"
              rel="noopener"
              referrerPolicy="strict-origin-when-cross-origin"
            >
              {company.name}
            </a>
          ) : (
            company.name
          )}
        </p>

        <h1 id="job-detail-title" className="detail-title">
          {job.title}
        </h1>

        <div className="detail-meta">
          <span className="detail-posted">
            {job.posted ? `Posted ${formatDate(job.posted)}` : 'Not specified'}
          </span>
          {company.accreditedSponsor && (
            <span className="flag flag-sponsor">Accredited sponsor</span>
          )}
          <ShareJob url={jobShareUrl(job.id)} title={job.title} />
        </div>
      </header>

      <div className="detail-main">
        <section>
          <h2 className="detail-heading">In a nutshell</h2>
          <dl className="detail-facts">
            <div className="fact">
              <dt className="fact-label">Job type</dt>
              <dd className="fact-value">{orNotSpecified(job.type)}</dd>
            </div>
            <div className="fact">
              <dt className="fact-label">Location</dt>
              <dd className="fact-value">{orNotSpecified(jobLocation(job))}</dd>
            </div>
            <div className="fact">
              <dt className="fact-label">Posted</dt>
              <dd className="fact-value">
                {job.posted ? formatDate(job.posted) : NOT_SPECIFIED}
              </dd>
            </div>
          </dl>
        </section>

        <section className="visa-box" aria-labelledby="visa-heading">
          <h2 id="visa-heading">
            Visa &amp; pathway{' '}
            <InfoTooltip text={VISA_DISCLAIMER} label="Visa guidance disclaimer" />
          </h2>
          <dl className="visa-facts">
            <div className="fact">
              <dt className="fact-label">
                Occupation{occupations.length > 1 ? 's' : ''}
              </dt>
              <dd className="fact-value">
                <Occupations occupations={occupations} />
              </dd>
            </div>
            <div className="fact">
              <dt className="fact-label">Can lead to</dt>
              <dd className="fact-value">
                <Pills items={pathwayVisas} />
              </dd>
            </div>
            {lists.length > 0 && (
              <div className="fact">
                <dt className="fact-label">
                  Occupation lists{' '}
                  <InfoTooltip
                    label="What the occupation lists mean"
                    text={lists.map(occupationListLabel).join('\n')}
                  />
                </dt>
                <dd className="fact-value">
                  <OccupationLists lists={lists} />
                </dd>
              </div>
            )}
            <div className="fact">
              <dt className="fact-label">
                Skills assessment{assessors.length > 1 ? 's' : ''}
              </dt>
              <dd className="fact-value">
                {assessors.length === 0 ? (
                  'Not specified'
                ) : (
                  <span className="fact-values">
                    {assessors.map((a) => (
                      <Reference key={a.name} text={a.name} href={a.url} />
                    ))}
                  </span>
                )}
              </dd>
            </div>
            <div className="fact">
              <dt className="fact-label">Accredited sponsor</dt>
              <dd className="fact-value">
                <Answer value={company.accreditedSponsor} yes="Yes" no="No" />
              </dd>
            </div>
            <div className="fact">
              <dt className="fact-label">Hires international students</dt>
              <dd className="fact-value">
                <Answer value={company.hiresInternationalStudents} yes="Yes" no="No" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="detail-section">
          <h2>About the employer</h2>
          {company.tagline && <p className="detail-about">{company.tagline}</p>}
          <dl className="detail-facts">
            {company.industries.length > 0 && (
              <div className="fact">
                <dt className="fact-label">Industry</dt>
                <dd className="fact-value">{prettyLabels(company.industries).join(', ')}</dd>
              </div>
            )}
            {/* The CSV's "Type" column, which holds two different kinds of
                thing at once: what the company makes (saas, big data,
                manufacturing) and how it makes money (commission,
                subscription, advertising). This was labelled "Builds", which
                is true of the first half and nonsense next to "commission". */}
            {company.types.length > 0 && (
              <div className="fact">
                <dt className="fact-label">Model &amp; tech</dt>
                <dd className="fact-value">{prettyLabels(company.types).join(', ')}</dd>
              </div>
            )}
            {company.growthStage && (
              <div className="fact">
                <dt className="fact-label">Stage</dt>
                <dd className="fact-value">
                  {prettyLabels([company.segment, company.growthStage].filter(Boolean)).join(' · ')}
                </dd>
              </div>
            )}
            {company.employees && (
              <div className="fact">
                <dt className="fact-label">Employees</dt>
                <dd className="fact-value">{company.employees}</dd>
              </div>
            )}
            {company.hqCity && (
              <div className="fact">
                <dt className="fact-label">Head office</dt>
                <dd className="fact-value">{company.hqCity}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {/* Everything you do rather than read. Given its own column when there is
          room for one, where it stays put as the role scrolls past. */}
      <aside className="detail-side">
        <div className="detail-actions">
          <ApplyButton url={job.applyUrl} jobTitle={job.title} />
          <p className="apply-note">
            {applyByEmail
              ? 'Applications for this role are sent by email to the employer.'
              : "Applications are handled on the employer's preferred website."}
          </p>
        </div>
      </aside>
    </article>
  );
}
