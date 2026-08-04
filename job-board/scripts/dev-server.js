// Tiny dependency-free helper for LOCAL development only. It lets the "Add a
// job (local)" admin panel write straight into public/jobs.json so you can add
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

const PORT = 4000;
const JOBS_FILE = path.join(__dirname, '..', 'public', 'jobs.json');
const OCC_FILE = path.join(__dirname, '..', 'src', 'data', 'occupations.json');
const CONST_FILE = path.join(__dirname, '..', 'src', 'data', 'constants.json');
const CONST_KEYS = ['jobLevel', 'type', 'arrangement', 'educationLevel', 'assessment', 'skills'];

function readJobs() {
  const raw = fs.readFileSync(JOBS_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('jobs.json is not an array');
  return data;
}

function readOccupations() {
  const raw = fs.readFileSync(OCC_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data) || typeof data !== 'object') {
    throw new Error('occupations.json is not an object');
  }
  return data;
}

function readConstants() {
  const raw = fs.readFileSync(CONST_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data) || typeof data !== 'object') {
    throw new Error('constants.json is not an object');
  }
  return data;
}

function nextId(jobs) {
  const max = jobs.reduce((m, j) => {
    const n = parseInt(j.id, 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return String(max + 1);
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

  if (req.method === 'POST' && req.url === '/api/jobs') {
    readBody(req, (raw) => {
      try {
        const incoming = JSON.parse(raw || '{}');
        if (!incoming.title || !incoming.company) {
          return sendJson(res, 400, { error: 'title and company are required' });
        }
        const jobs = readJobs();
        const job = { id: nextId(jobs), ...incoming };
        jobs.push(job);
        fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2) + '\n');
        console.log(`Added job #${job.id}: ${job.title} @ ${job.company}`);
        return sendJson(res, 201, { job });
      } catch (err) {
        return sendJson(res, 500, { error: String(err && err.message) || 'write failed' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`Local admin server on http://localhost:${PORT}`);
  console.log(`  jobs        → ${JOBS_FILE}`);
  console.log(`  occupations → ${OCC_FILE}`);
  console.log(`  constants   → ${CONST_FILE}`);
});
