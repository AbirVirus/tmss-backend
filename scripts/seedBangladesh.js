/**
 * Comprehensive Bangladesh location seeder.
 * Fetches data from nuhil/bangladesh-geocode (divisions, districts, upazilas, unions).
 * Maps them to our Location model: division → district → upazila → union.
 *
 * Usage: node scripts/seedBangladesh.js [--batch N] [--skip N]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const https = require('https');
const Location = require('../models/Location');

const REPO_BASE = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    https.get(`${REPO_BASE}/${path}`, (res) => {
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
  // nuhil's JSON wraps with phpmyadmin export metadata — find the data array
  for (const item of wrapper) {
    if (item.type === 'table' && item.data) return item.data;
  }
  return wrapper;
}

async function seedBangladesh() {
  const args = process.argv.slice(2);
  const batchSize = parseInt(args[args.indexOf('--batch') + 1]) || 500;
  const skip = parseInt(args[args.indexOf('--skip') + 1]) || 0;

  console.log('Fetching Bangladesh location data from GitHub...');

  const [divRaw, distRaw, upaRaw, uniRaw] = await Promise.all([
    fetchJSON('divisions/divisions.json'),
    fetchJSON('districts/districts.json'),
    fetchJSON('upazilas/upazilas.json'),
    fetchJSON('unions/unions.json')
  ]);

  const divisions = extractData(divRaw);
  const districts = extractData(distRaw);
  const upazilas = extractData(upaRaw);
  const unions = extractData(uniRaw);

  console.log(`Loaded: ${divisions.length} divisions, ${districts.length} districts, ${upazilas.length} upazilas, ${unions.length} unions`);

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

  console.log(`Mapped ${locations.length} locations`);

  // Seed in batches
  let inserted = 0;
  let skipped = 0;
  const total = locations.length;

  for (let i = skip; i < total; i += batchSize) {
    const batch = locations.slice(i, Math.min(i + batchSize, total));
    for (const loc of batch) {
      try {
        const exists = await Location.findOne({
          division: loc.division,
          district: loc.district,
          upazila: loc.upazila,
          union: loc.union,
          village: loc.village,
          para: loc.para
        });
        if (!exists) {
          await Location.create(loc);
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error inserting ${loc.union}: ${err.message}`);
      }
    }
    const progress = Math.min(i + batchSize, total);
    console.log(`Progress: ${progress}/${total} (${inserted} inserted, ${skipped} skipped)`);
  }

  console.log(`\nDone! ${inserted} inserted, ${skipped} skipped, ${locations.length} total`);
}

// Connect and run
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000
})
  .then(async () => {
    console.log('MongoDB connected');
    await seedBangladesh();
    console.log('Done. Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
