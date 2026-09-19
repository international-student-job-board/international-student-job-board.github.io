// What has changed on the board, newest first - edited by hand when something notable ships.
//
// The newest entry is what the banner shows; the rest are the list behind "All updates". Dates are
// the day the change went live. An entry stops being announced 21 days after its date (older news
// isn't news), but stays in the list.

export interface Update {
  /** YYYY-MM-DD. */
  date: string;
  text: string;
}

export const UPDATES: Update[] = [
  {
    date: '2026-09-12',
    text: 'Salary ranges and Glassdoor employer ratings!',
  },
];

/** How long the newest entry is announced in the banner. */
export const ANNOUNCE_DAYS = 21;
