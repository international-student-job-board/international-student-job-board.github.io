import { FEEDBACK_URL } from '../links';

const HOW = [
  { n: 1, title: 'Browse startup roles', body: 'Every job is open to international students and graduates.' },
  { n: 2, title: 'Check your visa fit', body: 'See the visa you can apply on, where it can lead, and the skills assessment.' },
  { n: 3, title: 'Apply on the employer’s site', body: 'We link you to the startup’s preferred hiring method.' },
];

const PATHWAY = [
  { step: 'Study', tag: 'visa 500', body: 'Study a STEM course on a Student visa.' },
  { step: 'Graduate', tag: 'visa 485', body: 'Move to a Temporary Graduate visa and start skilled work.' },
  { step: 'Skilled work', tag: 'ACS', body: 'Build local experience and complete a skills assessment.' },
  { step: 'Permanent residency', tag: 'visa 189 / 190 / 186', body: 'Progress to a skilled or employer-sponsored visa.' },
];

const NOW = [
  'Every role shown here accepts international students and graduates',
  'See which visa you need to be on to apply',
  'See which visas you can apply for with this job',
  'The visa pathway, including the skills assessment to get',
  'Whether the role offers an employer-sponsored visa',
  'Salary, employer details, job level, type and location',
  'Filter by every one of these fields',
];

const NEXT = [
  'A map view of jobs by location, coz that\'s easier to find where to work',
  'Create a resume once and apply on the spot; one resume, many job applications',
  'Track how your application is progressing',
  'Interview tips and reviews from international students who applied before',
  'Contact the hiring manager directly',
];

const REFERENCES = [
  { label: 'Study Melbourne', url: 'https://www.studymelbourne.vic.gov.au/' },
  { label: 'Victoria’s international education', url: 'https://www.study.vic.gov.au/' },
];

export function About() {
  return (
    <div className="about">
      <header className="about-hero">
        <p className="about-eyebrow">International student job board</p>
        <h1>Bringing international students to local startups!</h1>
        <p className="about-lede">
          We connect international students and graduates studying STEM with early-career roles at
          Melbourne startups.
          </p>
          <p className="about-lede">
          International students and graduates get a chance to build their career in Melbourne. Local startups gain
          access to a diverse talent pool who are eager to learn, grow and contribute to their new community.
        </p>
      </header>

      <section className="about-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="how-grid">
          {HOW.map((h) => (
            <li key={h.n} className="how-card">
              <span className="how-n" aria-hidden="true">
                {h.n}
              </span>
              <h3>{h.title}</h3>
              <p>{h.body}</p>
            </li>
          ))}
        </ol>
      </section>

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

      <div className="about-columns">
        <section className="about-section" aria-labelledby="now-heading">
          <h2 id="now-heading">What you can do today</h2>
          <ul className="check-list">
            {NOW.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="about-section" aria-labelledby="next-heading">
          <h2 id="next-heading">On the roadmap</h2>
          <ul className="check-list check-list-next">
            {NEXT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="about-section" aria-labelledby="scope-heading">
        <h2 id="scope-heading">Where we start</h2>
        <p>
          For now we focus on <strong>international students and graduates in STEM, in Melbourne,
          Victoria</strong>. Starting narrow lets us get the visas, skills assessments and
          pathways right. We’ll expand to more fields, cities and countries over time.
        </p>
        <p>
          Please submit a {' '}
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
            feedback or feature request
          </a>{' '}
          if you'd like to reach us!
        </p>
      </section>

      <section className="about-section" aria-labelledby="refs-heading">
        <h2 id="refs-heading">Resources</h2>
        <p>We build alongside the programs already supporting international students in Victoria.</p>
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
    </div>
  );
}
