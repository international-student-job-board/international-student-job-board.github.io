export const REPO_URL =
  'https://github.com/international-student-job-board/international-student-job-board.github.io';

export const FEEDBACK_URL = `${REPO_URL}/issues/new?title=${encodeURIComponent('Feedback: ')}`;

// Address startups can email their job brief to. Leave empty until you have one -
// the page will say it's coming soon. Emails use the subject prefix below so
// briefs are easy to triage into the CSV.
export const JOB_EMAIL = 'milindi.beeloud@gmail.com';
export const JOB_EMAIL_SUBJECT_PREFIX = 'Job post: ';

// General "Contact us" mailto for the footer.
export const CONTACT_MAILTO = JOB_EMAIL ? `mailto:${JOB_EMAIL}` : '';

// Fill-in-the-blanks brief pre-loaded into the email body. Visa fields are marked
// optional so startups aren't put off - we help fill those in.
export const JOB_EMAIL_BODY = `Hi,

Here's a role to list on the International Student Job Board.

- Company -
Company name:
One-line description:
Company link:
Application link or email (careers page / job-board link, or mailto: for email applications):

- The role -
Job title:
Level (Internship / Graduate / Junior / Mid / Senior / Other):
Type (Full-time / Part-time / Casual / Contract):
Work arrangement (On-site / Hybrid / Remote):
Suburb, City, State:
Open and close dates:
Salary or pay range:
Education level needed:
One-sentence summary:
Skills needed:

- Eligibility (optional - leave blank if you're not sure, we can help) -
ANZSCO occupation (the closest match, e.g. 261313 Software Engineer):
Can international students apply for this role? (Yes / No):
Offer employer-sponsored visas? (Yes / No):
  Compare options: https://immi.homeaffairs.gov.au/employer-subsite/Pages/compare-sponsored-skilled-visa-options.aspx

- You -
Your name:
Your email:

Thanks!`;

export const JOB_EMAIL_MAILTO = JOB_EMAIL
  ? `mailto:${JOB_EMAIL}?subject=${encodeURIComponent(JOB_EMAIL_SUBJECT_PREFIX)}` +
    `&body=${encodeURIComponent(JOB_EMAIL_BODY)}`
  : '';
