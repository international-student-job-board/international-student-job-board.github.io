import { JOB_EMAIL } from '../links';
import { EMPLOYER_VISA_COMPARISON_URL } from '../references';


export function PostJob() {
  return (
    <div className="about">
      <header className="about-intro">
        <h1>Hire up-and-coming STEM talent</h1>
        <p>
          Every job on this board is seen by international students and graduates in Melbourne
          who are eager to learn, grow and build a career here.
        </p>
      </header>

      <section className="about-section" aria-labelledby="post-heading">
        <h2 id="post-heading">Getting a role listed</h2>

        <p>
          Thank you for taking the time to post a role.

          Please, send a link / PDF of the job advert via the below email. We will manually review it, add the visa details related to the role and post it on the board within a day.
        </p>

        <p className="post-wip-note">
          Please email us at {' '}
          {JOB_EMAIL ? (
            <a href={`mailto:${JOB_EMAIL}`}>{JOB_EMAIL}</a>
          ) : (
            'get in touch through the contact link in the footer'
          )}{' '}
          with the deets!
        </p>

        <p className="about-note">
          Do state whether international students can apply, and whether you can
          sponsor a visa.
        </p>
        <p>
          For details on employer sponsored visas, please take a look at this {' '}
          <a
            className="gov-link"
            href={EMPLOYER_VISA_COMPARISON_URL}
            target="_blank"
            rel="noopener"
            referrerPolicy="strict-origin-when-cross-origin"
          >
           Department of Home Affairs website
          </a> which lists the different types of employer sponsored visas side by
          side.
        </p>
      </section>
    </div>
  );
}
