# The app

How the data, build and deploy work. For what the project *is*, start at the
[root README](../README.md).

Create React App + TypeScript. Builds into `../docs/`, which GitHub Pages serves.

```bash
npm install
npm start            # data server + dev server together, on :4000 and :3000
npm test
npm run build:pages  # build into ../docs for Pages
```

`npm start` runs **two** servers. `scripts/dev-server.js` serves and writes the
data files on port 4000; CRA serves the app on port 3000 and forwards data
requests to it. Starting CRA alone gives you a board with no jobs on it — see
[Where the data lives](#where-the-data-lives).

---

## Design

The interface follows *Refactoring UI*; the reasoning behind specific choices is
in comments in `src/App.css` next to the rules they explain.

---

## Where the data lives

| File | What it is | Written by |
|---|---|---|
| `content/australia_startup_scaleup_companies_jobs_anzsco.csv` | **The board.** One row per open role, with the employer's columns repeated on each of its roles | exported; Add a job (`/admin`) appends |
| `content/australia_companies.csv` | Every Australian startup/scaleup, whether or not it has a role listed | exported |
| `content/occupation-index.json` | ANZSCO code → occupation, lists, visas, assessing authority | `npm run fetch-occupations` |
| `content/skilled-occupations.json` | The full Home Affairs list the index is built from | `npm run fetch-occupations` |
| `content/constants.json` | The job-type pick-list | Add a job |

The two CSVs carry the same 15 company columns; the jobs file adds 10 more for
the role. Neither is derived from the other — the companies file includes
employers with nothing listed, and the jobs file is the newer export.

**They are joined at load.** The jobs export leaves *Hires international
students* blank on every row and that question is only recorded on the
companies list, so `loadJobs` fetches both and fills each employer's blanks from
its company record. The jobs row wins wherever it says something: it is the
newer of the two. An employer missing from the companies file is left as it
came, and a companies file that fails to load costs the merge, not the board.

### The jobs CSV

```
Company name, Segment, Type, Website, Growth stage, Employees, Industries,
HQ city, HQ address, Tagline, LinkedIn, Profile, Job openings,
Accredited sponsor, Hires international students,          ← the employer
Job title, Job type, ANZSCO occupation, ANZSCO 2022, ANZSCO 2013,
Job city, Job country, Date posted, Job URL, Job ID        ← the role
```

`src/jobs.ts` holds this column list and `scripts/data-files.js` holds a copy
for the writer; the header line in the file is what proves they agree.

Notes on reading it:

- **Roles lapse two months after they were posted.** There is no closing date
  in the file, so the posting date is what the board ages them by. The window is
  calendar months, measured against the *viewer's* date rather than the build's,
  so the board goes stale as it is read. `MONTHS_LISTED` in `src/jobs.ts` is the
  one place it is set. A role with no readable date stays — there is nothing to
  judge it by, and dropping it would hide a listing over a fault in its
  metadata.
- **Multi-value cells** accept `;`, `|` or `, ` — all three appear.
- **ANZSCO codes are read by shape** (`\b\d{6}\b`), so `261312|261313`,
  `261312, 261313` and `ANZSCO 261312 / 261313` all parse the same.
- **The two code columns stay apart.** Subclasses 186 and 482 are assessed
  against ANZSCO 2022 and every other visa against ANZSCO 2013. They agree for
  most occupations but not all, so merging them would hand the wrong code to
  whichever visa lost. Only the 2022 code links to ABS, because the browser we
  link to *is* the 2022 classification.
- **Blank is not "no"** in the two migration columns. It means nobody has
  checked, and the site says so in those words.

Everything about visas is derived from the codes — the occupation name, the
skilled lists, the visas it can lead to and the assessing authority all come
from `occupation-index.json`. Nothing about a role's visa consequences is typed
in by hand any more, which removes a whole class of disagreement: a role could
previously name one assessor while its occupation named another.

### Why `content/` and not `public/`

Because CRA's dev server watches all of `public/` and reloads the browser when
anything under it changes:

```js
// react-scripts/config/webpackDevServer.config.js
static: { directory: paths.appPublic, watch: { ignored: ignoredFiles(paths.appSrc) } }
```

So while these files lived in `public/`, adding a skill wrote the file, the
watcher saw the write, and the page reloaded out from under the half-filled form
that had just added it. They were in `src/data/` before that, where webpack
watched them and rebuilt the bundle — same bug, different watcher. Nothing
watches `content/`.

**In development** the files are served by `scripts/dev-server.js`. CRA routes
them there on its own: it proxies any GET for a path that doesn't exist in
`public/` and doesn't ask for HTML, so the URLs the app fetches are unchanged.

**In a build**, `scripts/sync-data.js` copies them into the build output — it
runs automatically as `postbuild` / `postbuild:pages`. It deliberately does not
copy them into `public/`: a copy sitting there would be served in preference to
the real file, and the site would quietly read a stale snapshot from the last
build instead of what the admin just wrote.

`scripts/data-files.js` is the one place that lists these files and their URLs.

### "The board is empty"

Almost always one of two things:

1. **No data server.** Nothing is listening on port 4000. `npm start` starts it
   for you; `npm run dev-server` starts it on its own.
2. **A stale process holding a port.** A dev server left running from days ago
   can hold port 3000 or 4000 while answering nothing. Check and clear it:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN     # and :4000
lsof -ti:3000 | xargs kill
```

`npm start` warns if port 4000 is held by something that isn't serving the data
files, and kills the data server it started when it exits, so it doesn't leave
orphans behind.

---

## The skilled occupation list

`npm run fetch-occupations` downloads the Home Affairs list into
`content/skilled-occupations.json` — **714 occupations**, each with its ANZSCO
codes, which lists it sits on, which visas it unlocks, and who assesses the
skills.

```
CSOL       458        distinct assessing authorities   42
ROL        220        occupations with no authority    24
STSOL      216
MLTSSL     216
RSMS ROL    23
```

### There is no official download

No CSV, no API, no bulk export — but it doesn't need scraping either. The whole
table ships **inside the page**, in a single hidden form field, as the JSON blob
that drives the page's own search box:

```html
<input id="ctl00_PlaceHolderMain_PageJSONDataHiddenField_Input"
       value="[{&quot;occupation&quot;:&quot;Aeroplane Pilot&quot;,…}]" />
```

`scripts/fetch-occupation-lists.js` reads that field, so it is working from the
same structured data the site's own search is built on rather than from rendered
table markup — which is why a redesign of the table won't break it. What would
break it is Home Affairs renaming the field, and the script fails loudly in that
case rather than writing a half-empty file.

The site returns 403 to anything that doesn't look like a browser, so the script
sets a User-Agent.

**Count:** the script finds 714 rows, all with distinct occupation names. The
page itself was showing 691 — that gap is unexplained. It may be that the page's
default view filters some rows, or the list may have changed. Worth a spot-check
before relying on the total.

### Is there an ABS version?

Not of this. The two halves of the data belong to different agencies, and only
one of them is ABS's:

- **ABS owns the classification** — codes, titles, structure — and publishes it
  as Excel. Note it is no longer ANZSCO: [**OSCA 2024**](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/latest-release)
  replaced it on 6 December 2024, adding ~300 occupations and retiring ~250.
  The [data downloads](https://www.abs.gov.au/statistics/classifications/osca-occupation-standard-classification-australia/2024-version-1-0/data-downloads)
  include `OSCA structure.xlsx` and `OSCA correspondence tables v2.xlsx` — the
  correspondence table is what maps ANZSCO ↔ OSCA if we ever migrate.
- **Home Affairs owns everything migration-related**: which occupations are on
  which list, which visas they unlock, and who assesses the skills. ABS never
  publishes any of that.

The authoritative source for the migration half is the legislative instrument —
[LIN 19/051](https://www.legislation.gov.au/F2019L00278/latest/text) for
subclasses 189, 190, 491, 485 and 407, with separate instruments for the CSOL —
but those are PDF and Word, so the page's embedded JSON is the more parseable
copy of the same facts. Nothing on data.gov.au carries the combination.

### The two ANZSCO versions

The list is split across two versions of ANZSCO, because the visas are:

> **Subclasses 186 and 482 use ANZSCO 2022. Every other visa still uses ANZSCO 2013.**

`skilled-occupations.json` keeps them as separate fields (`codes.anzsco2013`,
`codes.anzsco2022`) rather than merging them. They agree for all but 6
occupations, but picking one would silently hand the wrong code to whichever
visa lost.

This matters for the occupation picker:

- **255 of the 714** occupations carry only a 2013 code.
- Against `public/anzsco_codes.tsv` (ANZSCO 2022, 1,425 codes), 458 of 459 of
  the 2022 codes match, but only 638 of 671 of the 2013 codes do.

So a role picked from the current TSV can land on an occupation whose entry in
the official list is keyed differently. Unresolved.

### Not yet wired in

`skilled-occupations.json` holds exactly the three fields the admin currently
asks you to type by hand for each occupation — lists, assessing authority and
eligible visas. Nothing reads the file yet.

---

## Deploy

```bash
npm run build:pages
```

Then commit the updated `docs/` folder and push. The data files are copied into
`docs/` by the `postbuild:pages` step, so whatever is in `content/` at build time
is what goes live.

---

## Notes

- **Backend.** Occupations, companies and jobs are headed for an AWS database.
  Reads go through the loader modules (`jobs.ts`, `companies.ts`, `references.ts`,
  `constants.ts`, `anzsco.ts`) and writes through `devApi.ts`, so the swap is a
  change of URL and parsing rather than of call sites. Keep new data access
  behind those.
- **The admin is local-only.** `#/admin` renders in development builds only, and
  the server that backs it binds to loopback.
- **Design.** The UI follows *Refactoring UI*; the reasoning behind specific
  choices is in comments in `src/App.css` next to the rules they explain.
