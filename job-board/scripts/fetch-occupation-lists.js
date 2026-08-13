// Downloads the Home Affairs skilled occupation list into
// content/skilled-occupations.json.
//
//   npm run fetch-occupations
//
// There is no CSV, API or bulk download for this list. What there is: the whole
// table ships inside the page itself, in a single hidden form field, as a JSON
// blob the front end reads to drive its search box. That is what this reads.
//
//   <input id="ctl00_PlaceHolderMain_PageJSONDataHiddenField_Input"
//          value="[{&quot;occupation&quot;:…}]" />
//
// So it is not scraping rendered markup — it is the same structured data the
// page's own search is built on, which is why it survives a redesign of the
// table. What it does not survive is Home Affairs changing the field name, and
// that is why this fails loudly rather than writing a half-empty file.
//
// The values inside that JSON are themselves HTML fragments (links to ABS for
// the codes, links to each assessing authority), so each field is unwrapped
// once more below.
//
// Note the site 403s anything that doesn't look like a browser, hence the
// User-Agent.

const fs = require('fs');
const { contentPath } = require('./data-files');

const SOURCE = 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list';
const OUT = contentPath('skilled-occupations.json');
// The compact form the app actually loads: keyed by ANZSCO code, with only the
// fields the site shows. The full file above is ~600KB and most of that is
// prose nobody renders; this is the part worth putting on a phone connection.
const INDEX_OUT = contentPath('occupation-index.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—' };

function decode(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(n) ? whole : String.fromCodePoint(n);
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

// HTML fragment -> plain text. Block-level tags become spaces so that adjacent
// list items don't run into each other as one word.
function text(fragment) {
  return decode(String(fragment).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The ANZSCO codes for one occupation, and the ABS page for each.
 *
 * Most rows carry two, because the visas do: subclasses 186 and 482 moved to
 * ANZSCO 2022 while everything else stayed on ANZSCO 2013. They agree for all
 * but a handful of occupations, so they are kept apart rather than merged —
 * picking one would silently give the wrong code to whichever visa lost.
 *
 * Each code is a link on the source page, and the two versions point at
 * different ABS sites: the 2022 codes at the current classification browser,
 * the 2013 ones at the archived ausstats lookup. Those links are taken from the
 * page rather than constructed, because only one of the two is constructible —
 * the 2013 URLs end in an opaque document id.
 */
function parseCodes(fragment) {
  const html = decode(fragment);
  const codes = {};
  const urls = {};

  // Each code sits in its own anchor: the href is in the tag, the version and
  // the code in the link text ("ANZSCO 2022 - Subclass 186 and 482 visas -
  // 141999", "ANZSCO 2013 - 411511").
  for (const chunk of html.split(/<a\s/i).slice(1)) {
    const href = chunk.match(/href='([^']*)'/);
    const text = (chunk.split('>')[1] || '').split('<')[0];
    const version = text.match(/ANZSCO\s*(\d{4})/);
    const code = text.match(/(\d{6})\s*$/);
    if (!version || !code) continue;
    const key = version[1] === '2022' ? 'anzsco2022' : 'anzsco2013';
    if (!codes[key]) {
      codes[key] = code[1];
      if (href) urls[key] = href[1];
    }
  }

  // A handful of rows give the code as plain text with no link. They still have
  // a code worth keeping; they just have nowhere to point.
  for (const [, version, code] of html.matchAll(/ANZSCO\s*(\d{4})[^<']*?(\d{6})/g)) {
    const key = version === '2022' ? 'anzsco2022' : 'anzsco2013';
    if (!codes[key]) codes[key] = code;
  }

  return { codes, urls };
}

// Each authority is a link with the body of the popover beside it; the link
// text is the short name (e.g. VETASSESS) and the first external URL in the
// popover is its website.
function parseAuthorities(fragment) {
  const html = decode(fragment);
  const out = [];
  for (const item of html.split('<li>').slice(1)) {
    const name = text(item.split('<div')[0]);
    if (!name) continue;
    const url = item.match(/href='(https?[^']*)'/);
    out.push({ name, url: url ? decode(url[1]) : '' });
  }
  return out;
}

/**
 * Rebuilds the compact index from the file already on disk.
 *
 *   npm run fetch-occupations -- --local
 *
 * The full file is edited by hand as well as downloaded, so there has to be a
 * way to regenerate what is derived from it without going back to Home Affairs
 * and overwriting those edits.
 */
function rebuildFromDisk() {
  const payload = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const index = buildIndex(payload.occupations || []);
  fs.writeFileSync(
    INDEX_OUT,
    JSON.stringify({ retrieved: payload.retrieved || '', occupations: index }) + '\n'
  );
  console.log(`Rebuilt content/occupation-index.json — ${Object.keys(index).length} codes`);
}

/**
 * The compact form the app loads, keyed by ANZSCO code.
 *
 * Both classification versions key the same entry, so a job carrying either
 * code resolves. The duplication costs a few KB and saves every caller from
 * having to know which version it is holding.
 */
function buildIndex(occupations) {
  const index = {};
  for (const o of occupations) {
    const entry = {
      name: o.occupation,
      // Both codes travel together so the admin can fill both CSV columns from
      // one choice — the 2013 column is not guessable from the 2022 one.
      codes: o.codes,
      urls: o.urls || {},
      lists: o.lists,
      // Just the subclass number: "482 - Skills in Demand (subclass 482) - Core
      // Skills stream" is one visa, and the number is what the site links on.
      visas: Array.from(
        new Set(o.visas.map((v) => (v.match(/^\s*(\d{3})\b/) || [])[1]).filter(Boolean))
      ),
      assessors: o.assessingAuthorities,
    };
    for (const code of [o.codes.anzsco2022, o.codes.anzsco2013]) {
      if (code) index[code] = entry;
    }
  }
  return index;
}

async function main() {
  if (process.argv.includes('--local')) return rebuildFromDisk();

  process.stdout.write(`Fetching ${SOURCE}\n`);
  const res = await fetch(SOURCE, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Home Affairs returned ${res.status}`);
  const page = await res.text();

  const field = page.match(/PageJSONDataHiddenField_Input"\s+value="(.*?)"\s*\/>/s);
  if (!field) {
    throw new Error(
      'The occupation data field was not found in the page. Home Affairs has ' +
        'likely changed how the list is published — this script needs updating.'
    );
  }

  const rows = JSON.parse(decode(field[1]));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No occupation rows in the page');

  const occupations = rows.map((row) => ({
    occupation: text(row.occupation),
    ...parseCodes(row.anzscocode),
    // "MLTSSL;CSOL" -> ["MLTSSL", "CSOL"]
    lists: String(row.list || '')
      .split(';')
      .map((l) => l.trim())
      .filter(Boolean),
    // The visa strings carry their own subclass number, e.g.
    // "189 - Skilled Independent (subclass 189) - Points-Tested".
    visas: String(row.visas || '')
      .split(';')
      .map((v) => v.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    assessingAuthorities: parseAuthorities(row.assessauth),
  }));

  const index = buildIndex(occupations);

  const missing = occupations.filter((o) => !o.codes.anzsco2013 && !o.codes.anzsco2022);
  const payload = {
    source: SOURCE,
    retrieved: new Date().toISOString().slice(0, 10),
    count: occupations.length,
    occupations,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  fs.writeFileSync(
    INDEX_OUT,
    JSON.stringify({ retrieved: payload.retrieved, occupations: index }) + '\n'
  );

  console.log(`Wrote ${occupations.length} occupations to content/skilled-occupations.json`);
  console.log(`Wrote ${Object.keys(index).length} codes to content/occupation-index.json`);
  if (missing.length) console.warn(`${missing.length} occupations had no ANZSCO code`);
}

main().catch((err) => {
  console.error(`fetch-occupation-lists: ${err.message}`);
  process.exit(1);
});
