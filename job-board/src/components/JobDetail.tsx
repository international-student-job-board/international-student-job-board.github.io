import { Job } from '../types';
import { formatDate } from '../format';

function mapEmbedUrl(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`;
}

const VISA_PALETTE = ['#e0aaff', '#c77dff', '#9d4edd', '#7b2cbf', '#5a189a', '#3c096c'];

// A fixed shade per visa code so the same visa always looks the same.
const VISA_COLORS: Record<string, string> = {
  '500': '#e0aaff',
  '485': '#c77dff',
  '189': '#9d4edd',
  '190': '#7b2cbf',
  '186': '#5a189a',
  '482': '#3c096c',
};

// Lighter shades need dark text for contrast; darker shades take white.
const LIGHT_VISA = new Set(['#e0aaff', '#c77dff', '#9d4edd']);

function visaChipStyle(code: string, index: number) {
  const background = VISA_COLORS[code] ?? VISA_PALETTE[index % VISA_PALETTE.length];
  return { background, color: LIGHT_VISA.has(background) ? '#000103' : '#fffffa' };
}

function Pills({ items }: { items: string[] }) {
  if (!items.length) return <>Not specified</>;
  return (
    <span className="pill-list">
      {items.map((v, i) => (
        <span key={v} className="pill" style={visaChipStyle(v, i)}>
          {v}
        </span>
      ))}
    </span>
  );
}

export function JobDetail({ job }: { job: Job }) {
  return (
    <article className="job-detail" aria-labelledby="job-detail-title">
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

      <p className="detail-posted">
        Posted {formatDate(job.posted)} · Closes {formatDate(job.closes)}
      </p>

      {job.employerSponsored && (
        <p className="detail-flags">
          <span className="flag flag-sponsor">Visa sponsorship available</span>
        </p>
      )}

      {job.companyAbout && <p className="detail-about">{job.companyAbout}</p>}

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
        <h2 id="visa-heading">Visa &amp; pathway</h2>
        <ul className="visa-facts">
          <li>
            <span className="fact-label">Apply if you're on</span>
            <Pills items={job.visaEligible} />
          </li>
          <li>
            <span className="fact-label">Can lead to</span>
            <Pills items={job.visaPathways} />
          </li>
          <li>
            <span className="fact-label">Skills assessment</span>
            {job.skillAssessment || 'Not specified'}
          </li>
          <li>
            <span className="fact-label">Employer sponsorship</span>
            {job.employerSponsored ? 'Available' : 'Not offered'}
          </li>
        </ul>
        <div className="detail-actions">
          <a
            className="btn btn-primary"
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply
          </a>
        </div>
      </section>

      {job.summary && (
        <section className="detail-section">
          <h2>Job summary</h2>
          <p className="detail-description">{job.summary}</p>
        </section>
      )}

      {job.dayToDay && (
        <section className="detail-section">
          <h2>A typical day</h2>
          <p className="detail-description">{job.dayToDay}</p>
        </section>
      )}

      {job.dailySkills.length > 0 && (
        <section className="detail-section">
          <h2>Must have skills</h2>
          <ol className="skill-list">
            {job.dailySkills.slice(0, 5).map((skill) => (
              <li key={skill} className="skill">
                {skill}
              </li>
            ))}
          </ol>
        </section>
      )}

      {job.description && (
        <section className="detail-section">
          <h2>About the role</h2>
          <p className="detail-description">{job.description}</p>
        </section>
      )}

      {job.companyValues.length > 0 && (
        <section className="detail-section">
          <h2>Company values</h2>
          <ul className="value-list">
            {job.companyValues.map((value) => (
              <li key={value} className="value-chip">
                {value}
              </li>
            ))}
          </ul>
        </section>
      )}

      {job.careerAdvancement && (
        <section className="detail-section">
          <h2>Where it can lead</h2>
          <p className="detail-description">{job.careerAdvancement}</p>
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

      {job.location && (
        <details className="map-box">
          <summary>Location</summary>
          <div className="map-frame">
            <iframe
              title={`Map showing ${job.company} in ${job.location}`}
              src={mapEmbedUrl(job.location)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </details>
      )}

      <div className="detail-actions">
        <a
          className="btn btn-primary"
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apply
        </a>
        <p className="apply-note">
          Applications are handled on the employer's preferred website.
        </p>
      </div>
    </article>
  );
}
