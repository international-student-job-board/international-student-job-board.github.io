// The data the local admin can edit, and where each file is published.
//
// These three live in content/ rather than public/, and that placement is
// load-bearing. CRA's dev server watches the whole public/ directory and
// force-reloads the browser whenever anything under it changes:
//
//   static: { directory: paths.appPublic, watch: { ignored: … } }
//   — react-scripts/config/webpackDevServer.config.js
//
// So while these files sat in public/, saving a new skill wrote the file, the
// watcher saw the write, and the page reloaded out from under the half-filled
// form that had just added it. (They were moved out of src/ for the same
// reason once already — webpack watched them there. Two watchers, one bug.)
//
// Nothing watches content/. In development the files are served by
// scripts/dev-server.js, which CRA's proxy forwards to automatically: a GET for
// a path that does not exist in public/ falls through to the proxy, so the URLs
// below are unchanged from the app's point of view. For a production build,
// scripts/sync-data.js copies them into public/ first, and from there the
// normal CRA build copies them into the output.

const path = require('path');

// The CSV's columns, in file order. The app has its own copy in src/jobs.ts —
// these two must agree, and the header line in the file is what proves it.
const JOB_COLUMNS = [
  'Company name', 'State', 'Segment', 'Type', 'Website', 'Growth stage', 'Employees',
  'Industries', 'HQ city', 'HQ address', 'Tagline', 'LinkedIn',
  'Job openings', 'Accredited sponsor', 'Hires international students',
  'Job title', 'Job type', 'ANZSCO occupation', 'ANZSCO 2022', 'ANZSCO 2013',
  'ANZSCO unit group', 'ANZSCO unit group title', 'OSCA occupation', 'OSCA code',
  'Job city', 'Job country', 'Date posted', 'Job URL', 'Job ID', 'Invited Score',
];

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// `url` is what the browser asks for; `publicPath` is where a build puts it.
const DATA_FILES = [
  // The board itself: one row per open role. `fallback` is the header line, so
  // a missing file is created as an empty-but-valid CSV rather than nothing.
  {
    name: 'australia_startup_scaleup_companies_jobs_anzsco.csv',
    url: '/jobs.csv',
    publicPath: 'jobs.csv',
    csv: true,
    fallback: JOB_COLUMNS.join(',') + '\n',
  },
  // The "startups currently hiring" page. Its own file: it lists employers
  // whether or not they have a role on the board, so it is not derivable from
  // jobs.csv and jobs.csv is not derivable from it.
  {
    name: 'australia_companies.csv',
    url: '/companies.csv',
    publicPath: 'companies.csv',
    csv: true,
    fallback: 'Company name\n',
  },
  // Derived from the Home Affairs list by scripts/fetch-occupation-lists.js.
  // Everything the site knows about visas comes from here, keyed by ANZSCO code.
  {
    name: 'osca-index.json',
    url: '/data/osca-index.json',
    publicPath: 'data/osca-index.json',
    fallback: { retrieved: '', occupations: {} },
  },
  {
    name: 'occupation-index.json',
    url: '/data/occupation-index.json',
    publicPath: 'data/occupation-index.json',
    fallback: { retrieved: '', occupations: {} },
  },
  {
    name: 'constants.json',
    url: '/data/constants.json',
    publicPath: 'data/constants.json',
    fallback: {
      jobLevel: [],
      type: [],
      arrangement: [],
      educationLevel: [],
      assessment: [],
      skills: [],
    },
  },
  // Which SkillSelect round the jobs CSV's "Invited Score" column was read
  // off, written by find-startups/build.py alongside it.
  {
    name: 'invitation_round.json',
    url: '/data/invitation-round.json',
    publicPath: 'data/invitation-round.json',
    fallback: { retrieved: '', roundDate: '' },
  },
];

const contentPath = (name) => path.join(CONTENT_DIR, name);

module.exports = { CONTENT_DIR, PUBLIC_DIR, DATA_FILES, JOB_COLUMNS, contentPath };
