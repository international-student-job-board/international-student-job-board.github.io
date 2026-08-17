export const SITE_NAME = 'International Student Job Board';

// The public home of this board, used when telling an employer where an applicant came
// from.
export const SITE_URL =
  typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://international-student-job-board.github.io/';

/** Where to say thank you, if anyone would like to. */
export const KOFI_URL = 'https://ko-fi.com/milindi';

export const REPO_URL =
  'https://github.com/international-student-job-board/international-student-job-board.github.io';

export const FEEDBACK_URL = `${REPO_URL}/issues/new?title=${encodeURIComponent('Feedback: ')}`;

// Where employers send a role.
export const JOB_EMAIL = 'milindi.beeloud@gmail.com';

// General "Contact us" mailto for the footer.
export const CONTACT_MAILTO = JOB_EMAIL ? `mailto:${JOB_EMAIL}` : '';