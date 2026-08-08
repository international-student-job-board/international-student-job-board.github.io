import { FEEDBACK_URL } from '../links';
import { Resources } from './AboutSections';

const HOW_STUDENTS = [
  { n: 1, title: 'Checkout local startups', body: 'Every job posted here is open to international students and graduates.' },
  { n: 2, title: 'Vibe check', body: 'See the visa you can apply on, where it can lead, and if the role actually matches your skills.' },
  { n: 3, title: 'Apply on the employer’s site', body: 'We link you to the startup’s preferred hiring method.' },
];

const HOW_STARTUPS = [
  { n: 1, title: 'Tell us about the role', body: 'Email a PDF job advert, a link, or fill in the form with the job details.' },
  { n: 2, title: 'We review it', body: 'We manually go through the jobs posted, match them with the visa requirements, and add it to the site.' },
  { n: 3, title: 'Job gets posted', body: 'Your role appears on the board and links applicants to your preferred site for applications.' },
];

const NOW = [
  'Every role shown here accepts international students and graduates',
  'See which visa you need to be on to apply',
  'See which visas you can apply for with this job',
  'Possible visa pathway mapped out, including the skills assessment to get',
  'Whether the role offers an employer-sponsored visa',
  'Salary',
  'The usual like the the employer details, job level, type and location',
  'Filter by every one of these fields',
];

const NEXT = [
  'A map view of jobs by location, coz that\'s easier to find where to work',
  'Create one resume and use that to apply to many job applications (bye bye bye to forms!)',
  'Track how your application is progressing',
  'Interview tips and reviews from international students who applied to these startups before',
  'Networking events',
];

export function About() {
  return (
    <div className="about">
      <header className="about-hero">
        <h1>International students 🤝🏿 local startups</h1>
        <p className="about-lede">
          We have created this website to connect international students and graduates studying STEM with early-career roles at
          Melbourne startups.
          </p>
          <br></br>
          <p className="about-lede">
          This way international students and graduates get a chance to build their career here in Melbourne, and local startups gain
          access to a diverse talent pool who are eager to learn, grow and contribute to their new community.
        </p>
      </header>

      <section className="about-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>

        <h3 className="about-track">For students &amp; graduates</h3>
        <ol className="how-grid">
          {HOW_STUDENTS.map((h) => (
            <li key={h.n} className="how-step">
              <div className="how-head">
                <span className="how-n" aria-hidden="true">
                  {h.n}
                </span>
                <h3>{h.title}</h3>
              </div>
              <p>{h.body}</p>
            </li>
          ))}
        </ol>

        <h3 className="about-track">For startups currently hiring</h3>
        <ol className="how-grid">
          {HOW_STARTUPS.map((h) => (
            <li key={h.n} className="how-step">
              <div className="how-head">
                <span className="how-n" aria-hidden="true">
                  {h.n}
                </span>
                <h3>{h.title}</h3>
              </div>
              <p>{h.body}</p>
            </li>
          ))}
        </ol>
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
          <h2 id="next-heading">What's next</h2>
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
          We're starting small by focusing on <strong>international students and graduates in STEM, in Melbourne,
          Victoria</strong> and then expand to more fields, cities and countries over time.
        </p>
        <p>
         We are not migration lawyers, please work with registered migration agents or lawyers for any visa advice. Always check the <a href="https://immi.homeaffairs.gov.au/" target="_blank" rel="noopener noreferrer"> Department of Home Affairs</a> for the latest information on visa requirements and eligibility.
        </p>
        <p>
          Plus, gotta get my s**t together to build a proper backend to this GitHub pages website. Just thought of getting it out there whilst fleshing it out.
        </p>
        <p>
          Please submit a {' '}
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
            feedback or feature request
          </a>{' '}
          if you'd like to suggest anything to add to the site!
        </p>
      </section>

      <Resources />
    </div>
  );
}
