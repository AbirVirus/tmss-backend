/**
 * Pre-process Bangladesh location data into seed JSON.
 * Does NOT need MongoDB — just downloads from GitHub, maps the hierarchy, and outputs JSON.
 *
 * Usage: node scripts/buildSeedData.js > data/bangladesh-seed.json
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO_BASE = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function extractData(wrapper) {
  for (const item of wrapper) {
    if (item.type === 'table' && item.data) return item.data;
  }
  return wrapper;
}

async function main() {
  console.error('Fetching Bangladesh location data from GitHub...');

  const [divRaw, distRaw, upaRaw, uniRaw] = await Promise.all([
    fetchJSON(`${REPO_BASE}/divisions/divisions.json`),
    fetchJSON(`${REPO_BASE}/districts/districts.json`),
    fetchJSON(`${REPO_BASE}/upazilas/upazilas.json`),
    fetchJSON(`${REPO_BASE}/unions/unions.json`)
  ]);

  const divisions = extractData(divRaw);
  const districts = extractData(distRaw);
  const upazilas = extractData(upaRaw);
  const unions = extractData(uniRaw);

  console.error(`Loaded: ${divisions.length} divisions, ${districts.length} districts, ${upazilas.length} upazilas, ${unions.length} unions`);

  // Build lookup maps
  const divMap = {};
  for (const d of divisions) divMap[d.id] = d.name;

  const distMap = {};
  for (const d of districts) distMap[d.id] = { name: d.name, division_id: d.division_id };

  const upaMap = {};
  for (const u of upazilas) upaMap[u.id] = { name: u.name, district_id: u.district_id };

  // Build locations from unions
  const locations = [];
  for (const u of unions) {
    const upazila = upaMap[u.upazilla_id];
    if (!upazila) continue;
    const district = distMap[upazila.district_id];
    if (!district) continue;
    const division = divMap[district.division_id];
    if (!division) continue;

    locations.push({
      division,
      district: district.name,
      upazila: upazila.name,
      union: u.name,
      village: 'Default Village',
      para: 'Default Para'
    });
  }

  // Output as JSON array to stdout
  console.log(JSON.stringify(locations));
  console.error(`\nGenerated ${locations.length} location entries.`);
  console.error('Pipe this to a file: node scripts/buildSeedData.js > data/bangladesh-seed.json');
}

main().catch(err => { console.error(err); process.exit(1); });
