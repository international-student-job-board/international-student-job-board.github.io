// Compacts content/osca_occupation_list.json into the part the site shows.
//
//   npm run build-osca
//
// The source is 1.4MB, most of it alternative titles, specialisations and
// ANZSCO cross-references that nothing renders. What the site needs is a name
// and a unit group per code — the ABS page URL doesn't need storing at all,
// because a six-digit OSCA code contains its own path: 111131 lives at
// /1/11/111/1111/111131, so it can be rebuilt from the code.

const fs = require('fs');
const { contentPath } = require('./data-files');

const SOURCE = contentPath('osca_occupation_list.json');
const OUT = contentPath('osca-index.json');

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`build-osca: ${SOURCE} not found`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const occupations = payload.occupations || [];
  const index = {};

  for (const entry of occupations) {
    const code = String(entry.code || '').trim();
    if (!/^\d{6}$/.test(code)) continue;
    const unit = entry.hierarchy?.unitGroup;
    index[code] = {
      name: entry.occupation,
      ...(unit?.name ? { unitGroup: unit.name } : {}),
    };
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({ retrieved: payload.retrieved || '', occupations: index }) + '\n'
  );

  const size = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`build-osca: ${Object.keys(index).length} codes -> content/osca-index.json (${size}KB)`);
}

main();
