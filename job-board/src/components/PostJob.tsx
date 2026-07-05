import { JOB_FORM_EMBED_URL, JOB_EMAIL_MAILTO, JOB_EMAIL_SUBJECT_PREFIX } from '../links';

const STEPS = [
  { n: 1, title: 'Tell us about the role', body: 'Via email or form below with the job and visa details.' },
  { n: 2, title: 'We review it', body: 'We will check it and add it to the system.' },
  { n: 3, title: 'It goes live', body: 'Your role appears on the board and links applicants to your preferred site for applications.' },
];

const NEEDED = [
    'Company name',
    'One-line description about company',
    'Company link',

    'Application link (Role advert on the company careers page / external job board link / email)',
    'Level (Internship / Graduate / Junior / Mid)',
    'Type (Full-time / Part-time / Casual / Contract / Internship)',
    'Work arrangement (On-site / Hybrid / Remote)',
    'Location / suburb',
    'Salary or pay range',
    'Application open and close dates',
    'Education needed',
    'One-sentence summary',
    'What a typical day looks like in the role',
    'Skills needed',
    'Top 5 daily skills',
    'Company values',
    'Career growth opportunities',
    'Full description about job',

    '[OPTIONAL] Visa(s) a candidate can apply on (e.g. 485, 500)',
    '[OPTIONAL] Visa(s) this role can lead to (e.g. 189, 190, 186)',
    '[OPTIONAL] Skills assessment (e.g. ACS)',
    'Offer employer-sponsored visas? (Yes / No)',
    'Hirer name and email',
];

export function PostJob() {
  return (
    <div className="about">
      <header className="about-hero">
        <p className="about-eyebrow">For startups</p>
        <h1>Post a role and hire up-and-coming STEM talent.</h1>
        <p className="about-lede">
          List a role in minutes. Every job on the board is seen by international students
          and graduates in Melbourne who are eager to learn, grow and build a career here.
        </p>
      </header>

      <section className="about-section" aria-labelledby="post-how-heading">
        <h2 id="post-how-heading">How it works</h2>
        <ol className="how-grid">
          {STEPS.map((s) => (
            <li key={s.n} className="how-card">
              <span className="how-n" aria-hidden="true">
                {s.n}
              </span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-section">
        <details className="about-collapse">
          <summary>What you’ll need</summary>
          <ul className="check-list">
            {NEEDED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="about-note">
            Not sure about the relevant visa details? That’s completely fine, leave them
            open and we’ll help you work them out.
          </p>
        </details>
      </section>

      <section className="about-section" aria-labelledby="post-ways-heading">
        <h2 id="post-ways-heading">Submit a role</h2>
        <p>
          Email us the job advert (link or pdf) and we’ll add it for you, or fill in the form below,
          whichever is easier.
        </p>
        <h3 id="post-form-heading">Via email</h3>
        <p>
          {JOB_EMAIL_MAILTO ? (
            <a className="btn btn-primary" href={JOB_EMAIL_MAILTO}>
              Email your job post
            </a>
          ) : (
            <span className="post-email-soon">Email address coming soon.</span>
          )}
        </p>
        <p className="about-note">
          Please keep the email subject as{' '}
          <code>{JOB_EMAIL_SUBJECT_PREFIX}&lt;role&gt;</code> (for example{' '}
          <code>{JOB_EMAIL_SUBJECT_PREFIX}Frontend Engineer</code>).
        </p>
      </section>

      <section className="about-section" aria-labelledby="post-form-heading">
        <h3 id="post-form-heading">Via Google form</h3>
        {JOB_FORM_EMBED_URL ? (
          <div className="form-embed">
            <iframe
              title="Post a job form"
              src={JOB_FORM_EMBED_URL}
              loading="lazy"
            >
              Loading…
            </iframe>
          </div>
        ) : (
          <div className="form-placeholder">
            <p>
              The submission form is being set up. Add your Google Form’s embed URL in{' '}
              <code>src/links.ts</code> (<code>JOB_FORM_EMBED_URL</code>) and it will appear
              here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
