const PATHWAY = [
  { step: 'Study', tag: 'visa 500', body: 'Study a STEM course on a Student visa.' },
  { step: 'Graduate', tag: 'visa 485', body: 'Move to a Temporary Graduate visa and start skilled work.' },
  { step: 'Skilled work', tag: 'ACS', body: 'Build local experience and complete a skills assessment.' },
  { step: 'Permanent residency', tag: 'visa 189 / 190 / 186', body: 'Progress to a skilled or employer-sponsored visa.' },
];

const REFERENCES = [
  { label: 'Study Melbourne', url: 'https://www.studymelbourne.vic.gov.au/' },
  { label: 'Study VIC', url: 'https://www.study.vic.gov.au/' },
  { label: 'Skilled occupation list & ANZSCO list', url: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list' },
  { label: 'Occupation & industry profiles', url: 'https://www.jobsandskills.gov.au/data/occupation-and-industry-profiles/occupations' },
];

export function VisaPathway() {
  return (
    <section className="about-section" aria-labelledby="pathway-heading">
      <h2 id="pathway-heading">Example visa pathway</h2>
      <ol className="pathway">
        {PATHWAY.map((p, i) => (
          <li key={p.step} className="pathway-card">
            <span className="pathway-tag">{p.tag}</span>
            <div className="pathway-head">
              <span className="pathway-n" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{p.step}</h3>
            </div>
            <p>{p.body}</p>
          </li>
        ))}
      </ol>
      <p className="about-note">
        This is general information to help you plan, not immigration advice. Always check the{' '}
        <a href="https://immi.homeaffairs.gov.au/" target="_blank" rel="noopener noreferrer">
          Department of Home Affairs
        </a>{' '}
        and work with a registered migration agent for your situation.
      </p>
    </section>
  );
}

export function Resources() {
  return (
    <section className="about-section" aria-labelledby="refs-heading">
      <h2 id="refs-heading">Resources</h2>
      <p>Be well read, y'all</p>
      <ul className="ref-list">
        {REFERENCES.map((ref) => (
          <li key={ref.url}>
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              {ref.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
