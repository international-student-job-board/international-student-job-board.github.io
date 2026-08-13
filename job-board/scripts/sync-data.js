// Copies content/*.json into a finished build, so the deployed site ships the
// data the local admin has been editing. Runs automatically after
// `npm run build` and `npm run build:pages`.
//
//   node scripts/sync-data.js <build-dir>
//
// It writes into the build output rather than into public/ on purpose. A copy
// sitting in public/ would be served by CRA's dev server in preference to the
// real file, so the site would quietly read a stale snapshot from the last
// build instead of what the admin just wrote. See scripts/data-files.js for
// why these files live outside public/ in the first place.

const fs = require('fs');
const path = require('path');
const { DATA_FILES, contentPath } = require('./data-files');

const target = process.argv[2];
if (!target) {
  console.error('sync-data: a build directory is required (e.g. `build`)');
  process.exit(1);
}

const outDir = path.resolve(__dirname, '..', target);
if (!fs.existsSync(outDir)) {
  console.error(`sync-data: ${outDir} does not exist — run the build first`);
  process.exit(1);
}

for (const file of DATA_FILES) {
  const from = contentPath(file.name);

  // A missing source is created empty rather than failing the build: an empty
  // reference is a valid starting state, and a fresh clone should still build.
  if (!fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(from), { recursive: true });
    fs.writeFileSync(
      from,
      typeof file.fallback === 'string' ? file.fallback : JSON.stringify(file.fallback, null, 2) + '\n'
    );
    console.log(`sync-data: created empty content/${file.name}`);
  }

  const to = path.join(outDir, file.publicPath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`sync-data: ${file.name} -> ${target}/${file.publicPath}`);
}
