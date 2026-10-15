// Tells Google which role pages are new and which have gone, through the Indexing API - step 7 of
// Google's job posting guide ("Keep Google informed"), which recommends it over a sitemap because
// it gets the page crawled sooner:
// https://developers.google.com/search/docs/appearance/structured-data/job-posting
// https://developers.google.com/search/apis/indexing-api/v3/quickstart
//
//   npm run notify:google               after the deploy is live (the pages must already be up)
//   npm run notify:google -- --seed     once, first: record today's roles as known without
//                                       sending them - the sitemap already has them
//
// It reads the deployed sitemap (../docs/sitemap.xml), compares its role pages with the ones it
// has told Google about before (.indexing-state.json, beside this file's folder), and sends
// URL_UPDATED for each new role and URL_DELETED for each one that has come off the board. Google's
// default quota is 200 a day, so it stops there - newest roles first - and the next run carries on
// from where it stopped.
//
// Needs a Google Cloud service account with the Indexing API enabled, added as an Owner of the
// site in Search Console; its JSON key's path goes in GOOGLE_APPLICATION_CREDENTIALS. Without one
// it is a dry run: it says what it would send, and sends nothing.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SITEMAP = process.env.SITEMAP || path.join(ROOT, '..', 'docs', 'sitemap.xml');
const STATE = path.join(ROOT, '.indexing-state.json');
const QUOTA = Number(process.env.INDEXING_QUOTA || 200);
const KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PUBLISH = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const SCOPE = 'https://www.googleapis.com/auth/indexing';

/** The role pages the sitemap lists, newest first, with the day each was last changed. */
function rolesInSitemap() {
  if (!fs.existsSync(SITEMAP)) {
    console.error(`notify-google: no sitemap at ${SITEMAP} - build the site first`);
    process.exit(2);
  }
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  return Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), ([, entry]) => ({
    url: (entry.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '',
    lastmod: (entry.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '',
  }))
    .filter((entry) => /\/jobs\/[^/]+\/?$/.test(entry.url))
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}

const readState = () =>
  fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { known: {} };

const writeState = (state) => fs.writeFileSync(STATE, `${JSON.stringify(state, null, 1)}\n`);

const base64url = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** A short-lived access token for the service account, by the signed-JWT grant - no library. */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(key.private_key, 'base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const response = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`token request failed: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

async function main() {
  const roles = rolesInSitemap();
  const current = new Set(roles.map((role) => role.url));
  const state = readState();

  if (process.argv.includes('--seed')) {
    const today = new Date().toISOString().slice(0, 10);
    roles.forEach((role) => (state.known[role.url] = today));
    writeState(state);
    console.log(`notify-google: recorded ${roles.length} roles as known; nothing sent`);
    return;
  }

  // New roles first, newest first - they are what a searcher wants found today - then the roles
  // that have come off the board.
  const queue = [
    ...roles.filter((role) => !state.known[role.url]).map((role) => ({ url: role.url, type: 'URL_UPDATED' })),
    ...Object.keys(state.known)
      .filter((url) => !current.has(url))
      .map((url) => ({ url, type: 'URL_DELETED' })),
  ];
  const updates = queue.filter((n) => n.type === 'URL_UPDATED').length;
  console.log(
    `notify-google: ${updates} new role(s), ${queue.length - updates} removed, ` +
      `${Math.min(queue.length, QUOTA)} to send today (quota ${QUOTA})`
  );
  if (!queue.length) return;

  if (!KEY) {
    console.log('notify-google: GOOGLE_APPLICATION_CREDENTIALS is not set - dry run, nothing sent');
    queue.slice(0, 10).forEach((n) => console.log(`  would send ${n.type} ${n.url}`));
    return;
  }

  const token = await accessToken(JSON.parse(fs.readFileSync(KEY, 'utf8')));
  let sent = 0;
  for (const notification of queue.slice(0, QUOTA)) {
    const response = await fetch(PUBLISH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(notification),
    });
    if (response.status === 429) {
      console.log('notify-google: daily quota reached - the next run carries on from here');
      break;
    }
    if (!response.ok) {
      console.log(`  ${notification.type} ${notification.url} failed: ${response.status} ${await response.text()}`);
      continue;
    }
    // Recorded as each one lands, so a run that stops part-way never resends what went through.
    if (notification.type === 'URL_UPDATED') state.known[notification.url] = new Date().toISOString().slice(0, 10);
    else delete state.known[notification.url];
    writeState(state);
    sent += 1;
  }
  console.log(`notify-google: sent ${sent}`);
}

main().catch((error) => {
  console.error(`notify-google: ${error.message}`);
  process.exit(1);
});
