// Tiny dependency-free helper for LOCAL development only. It lets the "Add a
// job (local)" admin panel write straight into content/jobs.json so you can add
// roles without hand-editing the file. Run it alongside `npm start`:
//
//   node scripts/dev-server.js      (or: npm run dev-server)
//
// The CRA dev server proxies /api/* here (see "proxy" in package.json), so the
// app can POST to /api/jobs with no CORS setup. It is never part of the
// production build — the admin panel only renders in development.

const http = require('http');
const fs = require('fs');
const path = require('path');

const { DATA_FILES, JOB_COLUMNS, contentPath } = require('./data-files');

const PORT = 4000;
const JOBS_FILE = contentPath('jobs.csv');
const OCC_FILE = contentPath('occupations.json');
const CONST_FILE = contentPath('constants.json');
const CONST_KEYS = ['jobLevel', 'type', 'arrangement', 'educationLevel', 'assessment', 'skills'];

/**
 * Reads a file, creating it from `fallback` if it isn't there.
 *
 * A missing file used to surface as a bare ENOENT from inside a POST, which
 * says nothing about which file or why — and "why" is usually that these files
 * moved, or that this is a fresh clone. Creating it is the right answer either
 * way: an empty reference is a valid starting state.
 *
 * A string fallback is written as-is (the CSV's header line); anything else is
 * written as JSON.
 */
function readOrCreate(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof fallback === 'string' ? fallback : JSON.stringify(fallback, null, 2) + '\n'
    );
    console.log(`Created ${file}`);
  }
  const text = fs.readFileSync(file, 'utf8');
  return typeof fallback === 'string' ? text : JSON.parse(text);
}

function readOccupations() {
  const data = readOrCreate(OCC_FILE, {});
  if (Array.isArray(data) || typeof data !== 'object') {
    throw new Error('occupations.json is not an object');
  }
  return data;
}

function readConstants() {
  const data = readOrCreate(CONST_FILE, {
    jobLevel: [],
    type: [],
    arrangement: [],
    educationLevel: [],
    assessment: [],
    skills: [],
  });
  if (Array.isArray(data) || typeof data !== 'object') {
    throw new Error('constants.json is not an object');
  }
  return data;
}

const HEADER = JOB_COLUMNS.join(',') + '\n';

function readJobsCsv() {
  const text = readOrCreate(JOBS_FILE, HEADER);
  // A file that lost its header (hand-edited, or truncated) would silently turn
  // its first role into column names, so it is restored rather than trusted.
  return text.trimStart().startsWith(JOB_COLUMNS[0]) ? text : HEADER + text;
}

/** One cell, quoted only when it has to be. Mirrors escapeCell in src/csv.ts. */
function escapeCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The next free Job ID.
 *
 * Only numeric ids count towards the maximum: the CSV arrives with whatever ids
 * its source used, and a hand-added role must not collide with one. A file full
 * of non-numeric ids simply starts this at 1.
 */
function nextJobId(text) {
  const idColumn = JOB_COLUMNS.indexOf('Job ID');
  const max = text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => Number.parseInt(splitCsvLine(line)[idColumn] ?? '', 10))
    .reduce((m, n) => (Number.isNaN(n) ? m : Math.max(m, n)), 0);
  return String(max + 1);
}

/** Splits one CSV line, respecting quoted cells. */
function splitCsvLine(line) {
  const cells = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (line[i + 1] === '"') (field += '"'), (i += 1);
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') (cells.push(field), (field = ''));
    else field += char;
  }
  cells.push(field);
  return cells;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req, cb) {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) req.destroy(); // basic guard
  });
  req.on('end', () => cb(raw));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  // Friendly hint if someone opens this port in a browser by mistake.
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(
      'This is the local admin file-writer API, not the website.\n' +
        'Open the site at http://localhost:3000 (npm start).\n' +
        'Endpoints here: POST /api/jobs, /api/occupations, /api/constants.\n'
    );
  }

  // The data files themselves. In development these are not in public/, so
  // CRA's dev server has nothing to serve and forwards the request here (it
  // proxies any GET for a path that doesn't exist in public/ and doesn't ask
  // for HTML). The site therefore reads the same file the admin writes, live,
  // with no reload — which is the entire point of them living in content/.
  if (req.method === 'GET') {
    const file = DATA_FILES.find((f) => f.url === req.url.split('?')[0]);
    if (file) {
      try {
        const body = readOrCreate(contentPath(file.name), file.fallback);
        if (file.csv) {
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(body);
        }
        return sendJson(res, 200, body);
      } catch (err) {
        return sendJson(res, 500, { error: String(err && err.message) || 'read failed' });
      }
    }
  }

  // Append a value to a constant list (level, type, arrangement, education,
  // assessor). No-op if the value already exists.
  if (req.method === 'POST' && req.url === '/api/constants') {
    readBody(req, (raw) => {
      try {
        const { key, value } = JSON.parse(raw || '{}');
        if (!CONST_KEYS.includes(key)) {
          return sendJson(res, 400, { error: `unknown constant "${key}"` });
        }
        const clean = String(value || '').trim();
        if (!clean) return sendJson(res, 400, { error: 'value is required' });

        const constants = readConstants();
        const list = Array.isArray(constants[key]) ? constants[key] : [];
        if (!list.includes(clean)) {
          list.push(clean);
          constants[key] = list;
          fs.writeFileSync(CONST_FILE, JSON.stringify(constants, null, 2) + '\n');
          console.log(`Added ${key}: ${clean}`);
        }
        return sendJson(res, 200, { key, value: clean, list });
      } catch (err) {
        return sendJson(res, 500, { error: String(err && err.message) || 'write failed' });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/constants') {
    try {
      return sendJson(res, 200, { constants: readConstants() });
    } catch (err) {
      return sendJson(res, 500, { error: String(err && err.message) || 'read failed' });
    }
  }

  // Snapshot of the current occupations, so the admin can refresh its picker.
  if (req.method === 'GET' && req.url === '/api/occupations') {
    try {
      return sendJson(res, 200, { occupations: readOccupations() });
    } catch (err) {
      return sendJson(res, 500, { error: String(err && err.message) || 'read failed' });
    }
  }

  // Add or update an occupation entry, keyed by its 6-digit ANZSCO code.
  if (req.method === 'POST' && req.url === '/api/occupations') {
    readBody(req, (raw) => {
      try {
        const incoming = JSON.parse(raw || '{}');
        const code = String(incoming.code || '').trim();
        if (!/^\d{6}$/.test(code)) {
          return sendJson(res, 400, { error: 'a 6-digit ANZSCO code is required' });
        }
        if (!incoming.name) return sendJson(res, 400, { error: 'name is required' });

        const { code: _omit, ...record } = incoming;
        const occupations = readOccupations();
        const isNew = !occupations[code];
        occupations[code] = record;
        fs.writeFileSync(OCC_FILE, JSON.stringify(occupations, null, 2) + '\n');
        console.log(`${isNew ? 'Added' : 'Updated'} occupation ${code}: ${record.name}`);
        return sendJson(res, isNew ? 201 : 200, { code, occupation: record });
      } catch (err) {
        return sendJson(res, 500, { error: String(err && err.message) || 'write failed' });
      }
    });
    return;
  }

  // Append one role to content/jobs.csv.
  //
  // The row is built from JOB_COLUMNS rather than from whatever keys the form
  // sent, so a field the form forgets lands as an empty cell in the right
  // column instead of shifting every cell after it by one.
  if (req.method === 'POST' && req.url === '/api/jobs') {
    readBody(req, (raw) => {
      try {
        const incoming = JSON.parse(raw || '{}');
        const title = String(incoming['Job title'] || '').trim();
        const company = String(incoming['Company name'] || '').trim();
        if (!title || !company) {
          return sendJson(res, 400, { error: 'a job title and a company name are required' });
        }

        const text = readJobsCsv();
        const id = String(incoming['Job ID'] || '').trim() || nextJobId(text);
        const row = { ...incoming, 'Job ID': id };
        const line = JOB_COLUMNS.map((name) => escapeCell(row[name])).join(',');

        const separator = text.endsWith('\n') ? '' : '\n';
        fs.writeFileSync(JOBS_FILE, text + separator + line + '\n');
        console.log(`Added job #${id}: ${title} @ ${company}`);
        return sendJson(res, 201, { job: row });
      } catch (err) {
        return sendJson(res, 500, { error: String(err && err.message) || 'write failed' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

// Bound to the loopback address on purpose. This server writes to jobs.csv,
// occupations.json and constants.json with no authentication, and it answers
// any origin — which is fine for a tool only this machine can reach, and not
// fine on a shared network. Without the host argument Node listens on every
// interface, so anyone on the same wifi could post a job into the repo.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local admin server on http://localhost:${PORT}`);
  console.log(`  jobs        → ${JOBS_FILE}`);
  console.log(`  occupations → ${OCC_FILE}`);
  console.log(`  constants   → ${CONST_FILE}`);
});
